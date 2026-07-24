"use client";

import MacOSMenuBar from "@/components/ui/mac-os-menu-bar";

const DemoMacOSMenuBar = () => {
  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: '#ffffff',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '90%',
        maxWidth: '1200px'
      }}>
        <MacOSMenuBar
          onMenuAction={(action) => {
            console.log('Menu action:', action);
          }}
        />
      </div>
    </div>
  );
};

export { DemoMacOSMenuBar };
