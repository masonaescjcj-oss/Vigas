import { renderToolOg } from '@/lib/og';

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return renderToolOg(slug);
}
