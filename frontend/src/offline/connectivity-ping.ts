import axios from 'axios';
import { API_URL } from '@/lib/env';

export async function pingApiHealth(): Promise<boolean> {
  try {
    const { data } = await axios.get<{ status?: string }>(`${API_URL}/health`, {
      timeout: 5000,
      validateStatus: (s) => s < 500,
    });
    return data?.status === 'ok';
  } catch {
    return false;
  }
}
