import { permanentRedirect } from 'next/navigation';

export default function ChatRedirectPage() {
  permanentRedirect('/models');
}
