interface SectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function Section({ title, description, children, className = '' }: SectionProps) {
  return (
    <div className={`bg-white rounded-lg border border-gray-200 shadow-sm max-w-screen-lg mx-auto ${className}`}>
      <div className="px-4 py-5 sm:px-6">
        <h3 className="text-lg font-medium text-gray-900">
          {title}
        </h3>
        {description && (
          <p className="mt-1 text-sm text-gray-500">
            {description}
          </p>
        )}
      </div>
      <div className="px-4 py-5 sm:px-6 border-t border-gray-200">
        {children}
      </div>
    </div>
  );
}
