// Sổ địa chỉ giờ lưu trên BACKEND (ERD v2: bảng addresses) thay vì AsyncStorage,
// để địa chỉ là thực thể thật trong CSDL — đồng bộ đa thiết bị và admin thấy được.
// Giữ nguyên chữ ký hàm cũ để màn hình addresses.tsx / checkout.tsx không phải sửa.
import { apiListAddresses, apiCreateAddress, apiUpdateAddress, apiDeleteAddress, apiSetDefaultAddress, ApiAddress } from './api';

export type SavedAddress = {
  id: string;
  title: string;
  name: string;
  phone: string;
  street: string;
  wardCode: string;
  ward: string;
  provinceCode: string;
  province: string;
  isDefault: boolean;
};

const toSaved = (a: ApiAddress): SavedAddress => ({
  id: a.id, title: a.title, name: a.name, phone: a.phone, street: a.street,
  wardCode: a.wardCode, ward: a.ward, provinceCode: a.provinceCode, province: a.province,
  isDefault: a.isDefault,
});

export async function listAddresses(userId?:string): Promise<SavedAddress[]> {
  try {
    return (await apiListAddresses(userId)).map(toSaved);
  } catch {
    return [];
  }
}

export async function getDefaultAddress(userId?:string): Promise<SavedAddress | null> {
  const items = await listAddresses(userId);
  return items.find(a => a.isDefault) || items[0] || null;
}

export async function upsertAddress(address: Omit<SavedAddress, 'id'> & { id?: string }, userId?:string): Promise<SavedAddress[]> {
  const { id, ...fields } = address;
  if (id) await apiUpdateAddress(id, fields, userId);
  else await apiCreateAddress(fields, userId);
  return listAddresses(userId);
}

export async function deleteAddress(id: string, userId?:string): Promise<SavedAddress[]> {
  await apiDeleteAddress(id, userId);
  return listAddresses(userId);
}

export async function setDefaultAddress(id: string, userId?:string): Promise<SavedAddress[]> {
  await apiSetDefaultAddress(id, userId);
  return listAddresses(userId);
}
