import { motion } from 'framer-motion';
import { memo } from 'react';
import { classNames } from '~/utils/classNames';
import { cubicEasingFn } from '~/utils/easings';
import { genericMemo } from '~/utils/react';

export type SliderOptions<T> = {
  left: { value: T; text: string };
  middle?: { value: T; text: string };
  right: { value: T; text: string };
};

interface SliderProps<T> {
  selected: T;
  options: SliderOptions<T>;
  setSelected?: (selected: T) => void;
}

export const Slider = genericMemo(<T,>({ selected, options, setSelected }: SliderProps<T>) => {
  const hasMiddle = !!options.middle;
  const isLeftSelected = hasMiddle ? selected === options.left.value : selected === options.left.value;
  const isMiddleSelected = hasMiddle && options.middle ? selected === options.middle.value : false;

  return (
    <div className="flex items-center flex-wrap shrink-0 gap-1 bg-zinc-950/50 dark:bg-[#080810]/80 border border-purple-500/20 overflow-hidden rounded-full p-0.5 backdrop-blur-md shadow-[0_2px_10px_rgba(0,0,0,0.3)]">
      <SliderButton selected={isLeftSelected} setSelected={() => setSelected?.(options.left.value)}>
        {options.left.text}
      </SliderButton>

      {options.middle && (
        <SliderButton selected={isMiddleSelected} setSelected={() => setSelected?.(options.middle!.value)}>
          {options.middle.text}
        </SliderButton>
      )}

      <SliderButton
        selected={!isLeftSelected && !isMiddleSelected}
        setSelected={() => setSelected?.(options.right.value)}
      >
        {options.right.text}
      </SliderButton>
    </div>
  );
});

interface SliderButtonProps {
  selected: boolean;
  children: string | JSX.Element | Array<JSX.Element | string>;
  setSelected: () => void;
}

const SliderButton = memo(({ selected, children, setSelected }: SliderButtonProps) => {
  return (
    <button
      onClick={setSelected}
      className={classNames(
        'bg-transparent text-xs px-3 py-1 rounded-full relative font-medium transition-colors duration-150',
        selected
          ? 'text-cyan-200 dark:text-cyan-200'
          : 'text-zinc-400 hover:text-purple-300 dark:text-zinc-400 dark:hover:text-purple-200',
      )}
    >
      <span className="relative z-10 font-sans">{children}</span>
      {selected && (
        <motion.span
          layoutId="pill-tab"
          transition={{ duration: 0.2, ease: cubicEasingFn }}
          className="absolute inset-0 z-0 bg-gradient-to-r from-purple-600/30 to-cyan-600/30 border border-purple-500/30 dark:border-cyan-500/30 rounded-full shadow-[0_0_10px_rgba(168,85,247,0.15)]"
        ></motion.span>
      )}
    </button>
  );
});
