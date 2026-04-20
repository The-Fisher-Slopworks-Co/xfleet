// src/frontend/pages/NotFoundPage.tsx
export function NotFoundPage() {
  return (
    <div className="p-6 text-muted-foreground">
      <div className="text-destructive">ERR 404</div>
      <div>segment not found in filesystem</div>
    </div>
  );
}
