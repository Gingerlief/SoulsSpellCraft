import { ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { Editor } from './components/Editor/Editor';
import './App.css';

export default function App() {
  return (
    <ReactFlowProvider>
      <Editor />
    </ReactFlowProvider>
  );
}
