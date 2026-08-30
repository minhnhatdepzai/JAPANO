import { z } from "zod";

export const locationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  address: z.string().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  phone: z.string().optional(),
  openingHours: z.string().optional(),
  services: z.array(z.string()).optional(),
  active: z.boolean().optional(),
});

export const loginSchema = z.object({
  email: z.email("Email không hợp lệ."),
  password: z.string().min(1, "Hãy nhập mật khẩu."),
});

export const registerSchema = loginSchema.extend({
  name: z.string().trim().min(2, "Hãy nhập họ tên."),
  password: z.string().min(8, "Mật khẩu cần ít nhất 8 ký tự."),
});

export const checkoutSchema = z.object({
  name: z.string().trim().min(2, "Hãy nhập tên người nhận."),
  phone: z.string().trim().min(9, "Số điện thoại chưa hợp lệ."),
  address: z.string().trim().min(8, "Hãy nhập địa chỉ giao hàng đầy đủ."),
  paymentMethod: z.enum(["COD", "stripe", "vnpay"]),
});
