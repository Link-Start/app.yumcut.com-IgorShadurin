import { redirect } from 'next/navigation';

export default function OldStoryPage() {
  redirect('/?openMode=stories');
}
