import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function Home() {
  const [count, setCount] = useState(0);

  return (
    <div className="flex flex-col items-center gap-8 py-16">
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
        Welcome to Car App
      </h1>
      <p className="text-lg text-gray-600 dark:text-gray-400">
        A modern React application with last-generation stack.
      </p>
      <div className="flex items-center gap-4">
        <Button variant="secondary" onClick={() => setCount((c) => c - 1)}>
          -
        </Button>
        <span className="min-w-[3ch] text-center text-2xl font-semibold tabular-nums">
          {count}
        </span>
        <Button variant="secondary" onClick={() => setCount((c) => c + 1)}>
          +
        </Button>
      </div>
    </div>
  );
}
