// "/scene": placeholder for the "Where in space" 3D scene (built later in src/scene/).
// App.tsx loads this page with React.lazy, so three.js lands in its own chunk
// and never slows down Browse, Search or History.
// Default export: React.lazy expects a module whose default export is the component.
export default function ScenePage() {
  return (
    <section aria-labelledby="scene-title">
      <h1 id="scene-title" className="text-lg font-medium">
        Where in space
      </h1>
      <p className="mt-2 max-w-prose text-sm text-muted">
        A 3D map of where each image was taken: on Earth, in orbit, on Mars, or in deep space. Coming soon.
      </p>
    </section>
  );
}
