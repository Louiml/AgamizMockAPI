import { useEffect } from "react";
import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";
import { EndpointEditor } from "./components/EndpointEditor";
import { TrafficInspector } from "./components/TrafficInspector";
import { initRealtimeListeners, useMockStore } from "./store/useMockStore";
import { cn } from "./lib/cn";

export default function App() {
  const pane = useMockStore((s) => s.pane);
  const showTraffic = useMockStore((s) => s.showTraffic);

  useEffect(() => {
    initRealtimeListeners();
  }, []);

  return (
    <div className="app-canvas flex h-screen flex-col overflow-hidden text-gray-200">
      <Header />

      {pane === "traffic" ? (
        <div className="flex min-h-0 flex-1">
          <TrafficInspector />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <EndpointEditor />
            <div
              className={cn(
                "w-full shrink-0 transition-[height] duration-200",
                showTraffic ? "h-[38vh] min-h-0" : "h-9"
              )}
            >
              <TrafficInspector />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}