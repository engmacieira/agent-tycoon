/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { InspectorDrawer } from './components/InspectorDrawer';
import { Minimap } from './components/Minimap';
import { OfficeCanvas } from './components/OfficeCanvas';
import { RoomQuickBar } from './components/RoomQuickBar';
import { TopHud } from './components/TopHud';
import { OfficeProvider } from './context/OfficeContext';

export default function App() {
  return (
    <OfficeProvider>
      <div className="h-screen w-screen overflow-hidden flex flex-col bg-[#0B101B] text-slate-100">
        <TopHud />

        <main className="relative flex-1 flex overflow-hidden">
          <div className="relative flex-1 h-full overflow-hidden">
            <OfficeCanvas />

            {/* Bottom-Left Navigation & Minimap Overlay */}
            <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex items-end gap-3 z-10">
              <div className="pointer-events-auto shrink-0 hidden sm:block">
                <Minimap />
              </div>
              <div className="pointer-events-auto">
                <RoomQuickBar />
              </div>
            </div>
          </div>

          <InspectorDrawer />
        </main>
      </div>
    </OfficeProvider>
  );
}
