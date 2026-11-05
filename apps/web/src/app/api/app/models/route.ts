import { getModels } from '@/lib/data';
import { publicJson } from '@/lib/http';

export async function GET() {
  return publicJson({ items: await getModels() });
}
