const { EventEmitter } = require('events');

const DEFAULT_PRIORITIES = Object.freeze({
  motion: 300,
  tryon: 200,
  swimwear: 200,
  vision: 120,
  recommendation: 100,
});

class GpuJobCancelledError extends Error {
  constructor(message = 'Tác vụ GPU đã bị hủy.') {
    super(message);
    this.name = 'GpuJobCancelledError';
    this.code = 'GPU_JOB_CANCELLED';
    this.status = 409;
  }
}

/**
 * Hàng chờ độc quyền cho một GPU.
 *
 * Job đang chạy không bị cắt ngang chỉ vì có job ưu tiên cao hơn đến sau; job
 * ưu tiên cao hơn sẽ đứng đầu phần đang chờ. Việc cắt job đang chạy chỉ xảy ra
 * khi người dùng đổi focus màn hình và gọi cancel(), nhờ vậy không làm hỏng
 * một lượt inference chỉ vì hai request đến sát nhau.
 */
class GpuJobQueue extends EventEmitter {
  constructor(priorities = DEFAULT_PRIORITIES) {
    super();
    this.priorities = { ...DEFAULT_PRIORITIES, ...priorities };
    this.pending = [];
    this.active = null;
    this.sequence = 0;
  }

  run(type, task, metadata = {}) {
    if (typeof task !== 'function') throw new TypeError('GPU job phải là một hàm.');
    const normalizedType = String(type || '').trim();
    if (!(normalizedType in this.priorities)) throw new TypeError(`Loại GPU job không hợp lệ: ${normalizedType}`);

    return new Promise((resolve, reject) => {
      const item = {
        id: `gpu-${Date.now()}-${++this.sequence}`,
        type: normalizedType,
        priority: this.priorities[normalizedType],
        sequence: this.sequence,
        enqueuedAt: Date.now(),
        startedAt: null,
        metadata: { ...metadata },
        controller: new AbortController(),
        task,
        resolve,
        reject,
      };
      this.pending.push(item);
      this.pending.sort((a, b) => b.priority - a.priority || a.sequence - b.sequence);
      this.emit('queued', this.publicItem(item));
      this.drain();
    });
  }

  /**
   * Huỷ job theo loại, và nếu có `owner` thì chỉ huỷ job CỦA CHÍNH máy đó.
   *
   * Trước đây mọi lượt đổi màn hình đều huỷ sạch job cùng loại. Khi chỉ có một
   * máy dùng app thì không sao, nhưng lúc điện thoại USB và máy demo ở xa cùng
   * kết nối, người này rời màn hình thử đồ là lượt thử đồ của người kia chết
   * theo — đúng lỗi đã bắt được khi test thật (`GPU_JOB_CANCELLED`).
   *
   * Job không ghi chủ sở hữu vẫn bị huỷ như cũ, để client đời trước không đổi
   * hành vi.
   */
  cancel(types, reason = 'Người dùng đã chuyển khỏi màn hình sử dụng GPU.', owner = '') {
    const selected = new Set((Array.isArray(types) ? types : [types]).map(String));
    const scope = String(owner || '').trim();
    // Chỉ huỷ job của CHÍNH máy đã yêu cầu đổi màn hình.
    //
    // Hai lỗ hổng của bản trước, cả hai đều đã làm chết một lượt thử đồ thật:
    //   · `if (!scope) return true` — lệnh đổi focus không kèm danh tính huỷ
    //     sạch mọi job, kể cả của máy khác.
    //   · `return !jobOwner || ...` — job không kèm danh tính bị BẤT KỲ máy nào
    //     huỷ. Đo được: app trên điện thoại mở màn hình chủ, gửi focus="home",
    //     và cắt ngang lượt /api/tryon đang chạy dở của một client khác.
    //
    // Quy tắc mới: chỉ huỷ khi hai bên khớp danh tính, hoặc khi CẢ HAI đều
    // không có danh tính (cùng một bối cảnh ẩn danh, ví dụ script nội bộ).
    const mine = (item) => {
      const jobOwner = String(item.metadata?.owner || '').trim();
      if (!scope && !jobOwner) return true;
      return Boolean(scope) && jobOwner === scope;
    };
    const error = new GpuJobCancelledError(reason);
    const cancelled = [];
    const kept = [];
    for (const item of this.pending) {
      if (selected.has(item.type) && mine(item)) {
        item.controller.abort(error);
        item.reject(error);
        cancelled.push(this.publicItem(item));
      } else {
        kept.push(item);
      }
    }
    this.pending = kept;

    if (this.active && selected.has(this.active.type) && mine(this.active)
        && !this.active.controller.signal.aborted) {
      this.active.controller.abort(error);
      cancelled.push(this.publicItem(this.active));
    }
    if (cancelled.length) this.emit('cancelled', cancelled);
    return cancelled;
  }

  status() {
    return {
      active: this.active ? this.publicItem(this.active) : null,
      pending: this.pending.map((item, index) => ({ ...this.publicItem(item), position: index + 1 })),
      priorities: { ...this.priorities },
    };
  }

  publicItem(item) {
    return {
      id: item.id,
      type: item.type,
      priority: item.priority,
      enqueuedAt: item.enqueuedAt,
      startedAt: item.startedAt,
      metadata: { ...item.metadata },
      cancelled: item.controller.signal.aborted,
    };
  }

  drain() {
    if (this.active || !this.pending.length) return;
    const item = this.pending.shift();
    this.active = item;
    item.startedAt = Date.now();
    this.emit('started', this.publicItem(item));

    Promise.resolve()
      .then(() => item.task({
        id: item.id,
        type: item.type,
        priority: item.priority,
        queuedMs: item.startedAt - item.enqueuedAt,
        signal: item.controller.signal,
      }))
      .then(item.resolve, item.reject)
      .finally(() => {
        this.emit('finished', this.publicItem(item));
        if (this.active === item) this.active = null;
        this.drain();
      });
  }
}

module.exports = { GpuJobQueue, GpuJobCancelledError, DEFAULT_PRIORITIES };
