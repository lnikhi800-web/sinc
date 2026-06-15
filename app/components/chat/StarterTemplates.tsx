import React from 'react';
import type { Template } from '~/types/template';
import { STARTER_TEMPLATES } from '~/utils/constants';

interface FrameworkLinkProps {
  template: Template;
}

const FrameworkLink: React.FC<FrameworkLinkProps> = ({ template }) => (
  <a
    href={`/git?url=https://github.com/${template.githubRepo}.git`}
    data-state="closed"
    data-discover="true"
    className="flex items-center justify-center p-2.5 rounded-xl bg-purple-950/15 hover:bg-purple-500/10 border border-purple-500/10 hover:border-purple-500/30 transition-all duration-200 hover:scale-105"
  >
    <div
      className={`inline-block ${template.icon} w-7 h-7 text-3xl text-zinc-400 hover:text-cyan-400 transition-colors`}
      title={template.label}
    />
  </a>
);

const StarterTemplates: React.FC = () => {
  return (
    <div className="flex flex-col items-center gap-3.5 mt-2">
      <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">or start a blank app with your favorite stack</span>
      <div className="flex justify-center">
        <div className="flex flex-wrap justify-center items-center gap-3 max-w-sm">
          {STARTER_TEMPLATES.map((template) => (
            <FrameworkLink key={template.name} template={template} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default StarterTemplates;
