import type { Message } from 'ai';
import { toast } from 'react-toastify';
import { ImportFolderButton } from '~/components/chat/ImportFolderButton';
import { Button } from '~/components/ui/Button';
import { classNames } from '~/utils/classNames';

type ChatData = {
  messages?: Message[]; // Standard Bolt format
  description?: string; // Optional description
};

export function ImportButtons(importChat: ((description: string, messages: Message[]) => Promise<void>) | undefined) {
  return (
    <div className="flex flex-col items-center justify-center w-auto">
      <input
        type="file"
        id="chat-import"
        className="hidden"
        accept=".json"
        onChange={async (e) => {
          const file = e.target.files?.[0];

          if (file && importChat) {
            try {
              const reader = new FileReader();

              reader.onload = async (e) => {
                try {
                  const content = e.target?.result as string;
                  const data = JSON.parse(content) as ChatData;

                  // Standard format
                  if (Array.isArray(data.messages)) {
                    await importChat(data.description || 'Imported Chat', data.messages);
                    toast.success('Chat imported successfully');

                    return;
                  }

                  toast.error('Invalid chat file format');
                } catch (error: unknown) {
                  if (error instanceof Error) {
                    toast.error('Failed to parse chat file: ' + error.message);
                  } else {
                    toast.error('Failed to parse chat file');
                  }
                }
              };
              reader.onerror = () => toast.error('Failed to read chat file');
              reader.readAsText(file);
            } catch (error) {
              toast.error(error instanceof Error ? error.message : 'Failed to import chat');
            }
            e.target.value = ''; // Reset file input
          } else {
            toast.error('Something went wrong');
          }
        }}
      />
      <div className="flex flex-col items-center gap-4 max-w-2xl text-center">
        <div className="flex gap-2">
          <Button
            onClick={() => {
              const input = document.getElementById('chat-import');
              input?.click();
            }}
            variant="default"
            size="lg"
            className="gap-2 bg-zinc-950/40 hover:bg-purple-500/5 text-purple-300 hover:text-purple-200 border border-purple-500/15 hover:border-purple-500/35 rounded-xl h-10 px-5 py-2 min-w-[130px] justify-center transition-all duration-200 cursor-pointer shadow-[0_0_10px_rgba(168,85,247,0.02)]"
          >
            <span className="i-ph:upload-simple w-4 h-4" />
            Import Chat
          </Button>
          <ImportFolderButton
            importChat={importChat}
            className="gap-2 bg-zinc-950/40 hover:bg-purple-500/5 text-purple-300 hover:text-purple-200 border border-purple-500/15 hover:border-purple-500/35 rounded-xl h-10 px-5 py-2 min-w-[130px] justify-center transition-all duration-200 cursor-pointer shadow-[0_0_10px_rgba(168,85,247,0.02)]"
          />
        </div>
      </div>
    </div>
  );
}
