import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";

export function NotFound() {
  return (
    <div className="flex flex-col items-center gap-6 py-24">
      <h1 className="text-6xl font-bold">404</h1>
      <p className="text-lg text-gray-600 dark:text-gray-400">
        Page not found.
      </p>
      <Link to="/">
        <Button>Go Home</Button>
      </Link>
    </div>
  );
}
