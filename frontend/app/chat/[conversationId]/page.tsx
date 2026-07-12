import PageShell from "@/components/common/PageShell";

export default function ChatConversation({ params }: { params: { conversationId: string } }) {
  return <PageShell title={`Conversation ${params.conversationId}`} description="Continue your message thread with the community." />;
}
