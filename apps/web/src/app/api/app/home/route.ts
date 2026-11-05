import { getHomeFeed } from '@/lib/data';
import { publicJson } from '@/lib/http';

export async function GET() {
  return publicJson(await getHomeFeed());
}
