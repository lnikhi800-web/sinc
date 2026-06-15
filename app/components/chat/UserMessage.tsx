/*
 * @ts-nocheck
 * Preventing TS checks with files presented in the video for a better presentation.
 */
import { MODEL_REGEX, PROVIDER_REGEX } from '~/utils/constants';
import { Markdown } from './Markdown';
import { useStore } from '@nanostores/react';
import { profileStore } from '~/lib/stores/profile';
import type {
  TextUIPart,
  ReasoningUIPart,
  ToolInvocationUIPart,
  SourceUIPart,
  FileUIPart,
  StepStartUIPart,
} from '@ai-sdk/ui-utils';

interface UserMessageProps {
  content: string | Array<{ type: string; text?: string; image?: string }>;
  parts:
    | (TextUIPart | ReasoningUIPart | ToolInvocationUIPart | SourceUIPart | FileUIPart | StepStartUIPart)[]
    | undefined;
}

export function UserMessage({ content, parts }: UserMessageProps) {
  const profile = useStore(profileStore);

  // Extract images from parts - look for file parts with image mime types
  const images =
    parts?.filter(
      (part): part is FileUIPart => part.type === 'file' && 'mimeType' in part && part.mimeType.startsWith('image/'),
    ) || [];

  if (Array.isArray(content)) {
    const textItem = content.find((item) => item.type === 'text');
    const textContent = stripMetadata(textItem?.text || '');

    return (
      <div className="overflow-hidden flex flex-col gap-3 items-center ">
        <div className="flex flex-row items-start justify-center overflow-hidden shrink-0 self-start">
          {profile?.avatar || profile?.username ? (
            <div className="flex items-end gap-2">
              <img
                src={profile.avatar}
                alt={profile?.username || 'User'}
                className="w-[25px] h-[25px] object-cover rounded-full"
                loading="eager"
                decoding="sync"
              />
              <span className="text-bolt-elements-textPrimary text-sm">
                {profile?.username ? profile.username : ''}
              </span>
            </div>
          ) : (
            <div className="i-ph:user-fill text-accent-500 text-2xl" />
          )}
        </div>
        <div className="flex flex-col gap-4 bg-purple-950/20 dark:bg-purple-500/5 backdrop-blur-md border border-purple-500/15 shadow-[0_0_15px_rgba(168,85,247,0.06)] p-4 w-auto rounded-2xl rounded-tr-sm mr-auto">
          {textContent && <Markdown html>{textContent}</Markdown>}
          {images.map((item, index) => (
            <img
              key={index}
              src={`data:${item.mimeType};base64,${item.data}`}
              alt={`Image ${index + 1}`}
              className="max-w-full h-auto rounded-lg"
              style={{ maxHeight: '512px', objectFit: 'contain' }}
            />
          ))}
        </div>
      </div>
    );
  }

  const textContent = stripMetadata(content);

  return (
    <div className="flex flex-col gap-1.5 items-end max-w-[85%] ml-auto animate-fade-in">
      <div className="flex items-center gap-2 mr-1">
        <span className="text-zinc-400 text-[11px] font-sans font-medium">
          {profile?.username || 'You'}
        </span>
        {profile?.avatar ? (
          <img
            src={profile.avatar}
            alt={profile?.username || 'User'}
            className="w-[18px] h-[18px] object-cover rounded-full border border-purple-500/30"
            loading="eager"
            decoding="sync"
          />
        ) : (
          <div className="i-ph:user-fill text-purple-400 text-xs" />
        )}
      </div>
      <div className="flex flex-col bg-[#110e20]/65 dark:bg-purple-950/20 backdrop-blur-md border border-purple-500/20 shadow-[0_0_20px_rgba(168,85,247,0.08)] px-4.5 py-3 w-full rounded-2xl rounded-tr-sm">
        <div className="flex gap-3.5 mb-4">
          {images.map((item, index) => (
            <div key={index} className="relative flex rounded-lg border border-purple-500/20 overflow-hidden">
              <div className="h-16 w-16 bg-transparent outline-none">
                <img
                  src={`data:${item.mimeType};base64,${item.data}`}
                  alt={`Image ${index + 1}`}
                  className="h-full w-full rounded-lg"
                  style={{ objectFit: 'fill' }}
                />
              </div>
            </div>
          ))}
        </div>
        <Markdown html>{textContent}</Markdown>
      </div>
    </div>
  );
}

function stripMetadata(content: string) {
  const artifactRegex = /<boltArtifact\s+[^>]*>[\s\S]*?<\/boltArtifact>/gm;
  return content.replace(MODEL_REGEX, '').replace(PROVIDER_REGEX, '').replace(artifactRegex, '');
}
