"""Generate a portable HTML evidence dashboard from actual local training reports."""
import html
import json
from pathlib import Path
from data_workbench import DEFAULT,ROOT,save


def main():
    dest=ROOT/'docs/ai-evidence-20260928';dest.mkdir(exist_ok=True)
    reports={}
    for name in ['chat-lora-20260928','chat-vera-20260928','fashion-resnet18-20260928']:
        file=ROOT/'backend/ai_training/runs'/name/'report.json'
        if file.exists():reports[name]=json.loads(file.read_text())
    sources=[json.loads((DEFAULT/'raw'/name/'manifest.json').read_text()) for name in ['support','fashion','retail']]
    sft=json.loads((DEFAULT/'sft.manifest.json').read_text())
    evidence={'reports':reports,'sources':sources,'dataset':sft,
      'gpuObserved':{'model':'RTX 5060 Ti','vramTotalMiB':16311,'veraSampleUsedMiB':15193,'veraSampleUtilizationPercent':100},
      'warning':'Small offline evaluations; no human production approval. Image classifier is not a fine-tuned try-on generator.'}
    save(dest/'evidence.json',evidence)
    metrics=[]
    for name,r in reports.items():
        acc=r.get('adapterAccuracy',r.get('heldout',{}).get('accuracy'))
        metrics.append(f'<tr><td>{html.escape(name)}</td><td>{r["optimizerSteps"]}</td><td>{100*acc:.2f}%</td><td>{str(r["reloadVerified"]).lower()}</td></tr>')
    source_rows=''.join(f'<tr><td><a href="{html.escape(s["source"])}">{html.escape(s["source"].split("/")[-1])}</a></td><td>{html.escape(s["license"])}</td><td>{"Tổng hợp" if s["synthetic"] else "Ảnh catalog"}</td></tr>' for s in sources)
    page='''<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>JAPANO · Bằng chứng huấn luyện</title>
<style>body{font:17px/1.6 system-ui;background:#f5f1e9;color:#202d29;max-width:1080px;margin:40px auto;padding:24px}h1{font-size:42px;line-height:1.2}small{color:#55645e}section{background:white;padding:24px;margin:20px 0;border-radius:12px}table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:12px;border-bottom:1px solid #ddd}code,pre{white-space:pre-wrap;overflow-wrap:anywhere}button{padding:10px 16px;cursor:pointer}a{color:#315f4c}</style>
<small>JAPANO · 28/09/2026 · KẾT QUẢ THỰC TẾ</small><h1>Từ dữ liệu đến adapter.<br>Có checkpoint, có phép đo.</h1>
<section><h2>Luồng demo</h2><p>Database JSON / CSV → chỉ lấy sản phẩm công khai → JSONL có nguồn → tách train/validation/test theo nhóm → LoRA / VeRA → nạp lại + SHA-256 → LangGraph → trả lời từ catalog hiện tại.</p><p>LangGraph điều phối. Qwen học phân loại ý định. Giá và tồn kho do backend lấy từ database.</p></section>
<section><h2>Huấn luyện đã chạy</h2><table><tr><th>Mô hình</th><th>Bước cập nhật</th><th>Độ đúng tập kiểm tra</th><th>Nạp lại được</th></tr>'''+''.join(metrics)+'''</table><p>Chat: 76 câu kiểm tra, baseline 75%; nhãn tổng hợp cần người rà soát. Ảnh: 600 ảnh studio, ba nhóm sản phẩm. Không suy rộng thành độ đúng mọi hội thoại hoặc độ chân thật thử đồ.</p></section>
<section><h2>Dữ liệu đã tải</h2><table><tr><th>Nguồn Kaggle</th><th>Giấy phép công bố</th><th>Loại</th></tr>'''+source_rows+'''</table><p>Retail Sales là dữ liệu giả lập của tác giả, không phải doanh thu/khách JAPANO. Dữ liệu khách riêng tư không nằm trong tập SFT.</p></section>
<section><h2>Ranh giới bằng chứng</h2><p>ResNet18 phân loại ảnh sản phẩm. FASHN/FLUX vẫn chạy trọng số gốc để thử đồ. Chưa fine-tune bộ sinh ảnh thử đồ hoặc mô hình chuyển động. Không suy ra số đo cơ thể chính xác từ một ảnh.</p><details><summary>Xem toàn bộ số liệu và hash</summary><pre>'''+html.escape(json.dumps(evidence,ensure_ascii=False,indent=2))+'''</pre></details></section><button onclick="window.print()">In / lưu PDF để trình bày</button></html>'''
    (dest/'presentation.html').write_text(page,encoding='utf-8')
    print(dest/'presentation.html')


if __name__=='__main__':main()
