import MazeVisualizer from "@/components/MazeVisualizer";
import { MadeWithDyad } from "@/components/made-with-dyad";

const Index = () => {
  return (
    <div className="min-h-screen p-4 md:p-8 bg-background">
      <div className="max-w-6xl mx-auto space-y-4">
        <MazeVisualizer />
        <MadeWithDyad />
      </div>
    </div>
  );
};

export default Index;