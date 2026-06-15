import React from 'react';

const EXAMPLE_PROMPTS = [
  { text: 'Create a mobile app about SINC' },
  { text: 'Build a todo app in React using Tailwind' },
  { text: 'Build a simple blog using Astro' },
  { text: 'Create a cookie consent form using Material UI' },
  { text: 'Make a space invaders game' },
  { text: 'Make a Tic Tac Toe game in html, css and js only' },
];

export function ExamplePrompts(sendMessage?: { (event: React.UIEvent, messageInput?: string): void | undefined }) {
  return (
    <div id="examples" className="relative flex flex-col gap-9 w-full max-w-3xl mx-auto flex justify-center mt-6">
      <div
        className="flex flex-wrap justify-center gap-2"
        style={{
          animation: '.25s ease-out 0s 1 _fade-and-move-in_g2ptj_1 forwards',
        }}
      >
        {EXAMPLE_PROMPTS.map((examplePrompt, index: number) => {
          return (
            <button
              key={index}
              onClick={(event) => {
                sendMessage?.(event, examplePrompt.text);
              }}
              className="border border-purple-500/15 hover:border-purple-500/45 rounded-full bg-purple-950/10 hover:bg-purple-950/25 dark:bg-[#06060c]/40 dark:hover:bg-purple-500/10 text-purple-300/80 hover:text-purple-200 px-3.5 py-1.5 text-xs transition-all duration-200 shadow-[0_0_10px_rgba(168,85,247,0.02)] cursor-pointer"
            >
              {examplePrompt.text}
            </button>
          );
        })}
      </div>
    </div>
  );
}
