export function About() {
  return (
    <div className="flex flex-col gap-6 py-16">
      <h1 className="text-4xl font-bold tracking-tight">About</h1>
      <div className="prose dark:prose-invert">
        <p className="text-lg text-gray-600 dark:text-gray-400">
          This application was built with the following technologies:
        </p>
        <ul className="mt-4 space-y-2 text-gray-600 dark:text-gray-400">
          <li>React 19 + TypeScript</li>
          <li>Vite 8</li>
          <li>Tailwind CSS 4</li>
          <li>React Router 7</li>
          <li>Zustand 5</li>
          <li>TanStack Query 5</li>
          <li>Zod 4</li>
          <li>Vitest + Testing Library</li>
        </ul>
      </div>
    </div>
  );
}
