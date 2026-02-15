import { h } from 'preact';
import { ANNOTATION_COLORS } from '../../shared/constants';
import { Tooltip } from './Tooltip';

export type ToolType = 'select' | 'rect' | 'text' | 'arrow' | 'blur' | 'crop' | 'delete';

export interface ToolPaletteProps {
  activeTool: ToolType;
  activeColor: string;
  onToolChange: (tool: ToolType) => void;
  onColorChange: (color: string) => void;
  onDelete: () => void;
}

const TOOLS: { id: ToolType; label: string; tooltip: string }[] = [
  { id: 'select', label: 'Select', tooltip: 'Move and resize annotations' },
  { id: 'rect', label: 'Rectangle', tooltip: 'Draw a highlight rectangle' },
  { id: 'text', label: 'Text', tooltip: 'Click anywhere to add text' },
  { id: 'arrow', label: 'Arrow', tooltip: 'Draw an arrow between points' },
  { id: 'blur', label: 'Blur', tooltip: 'Permanently redact sensitive areas' },
  { id: 'crop', label: 'Crop', tooltip: 'Trim the screenshot to a region' },
];

const buttonBase = {
  padding: '6px 12px',
  border: '1px solid #334155',
  borderRadius: '4px',
  cursor: 'pointer',
  fontSize: '12px',
  fontFamily: 'inherit',
  transition: 'all 0.15s ease',
};

export function ToolPalette({
  activeTool,
  activeColor,
  onToolChange,
  onColorChange,
  onDelete,
}: ToolPaletteProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 14px',
        flexWrap: 'wrap',
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        borderRadius: '8px',
        boxShadow: 'none',
        border: '1px solid #1e293b',
      }}
      data-testid="tool-palette"
    >
      {TOOLS.map((tool) => (
        <Tooltip key={tool.id} text={tool.tooltip}>
          <button
            type="button"
            onClick={() => onToolChange(tool.id)}
            data-testid={`tool-${tool.id}`}
            style={{
              ...buttonBase,
              backgroundColor: activeTool === tool.id ? '#3b82f6' : 'transparent',
              color: activeTool === tool.id ? '#ffffff' : '#e2e8f0',
            }}
          >
            {tool.label}
          </button>
        </Tooltip>
      ))}

      <Tooltip text="Delete the selected annotation">
        <button
          type="button"
          onClick={onDelete}
          data-testid="tool-delete"
          style={{
            ...buttonBase,
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            color: '#fca5a5',
            borderColor: '#f87171',
          }}
        >
          Remove Annotation
        </button>
      </Tooltip>

      <span style={{ width: '1px', height: '24px', backgroundColor: '#334155', margin: '0 4px' }} />

      {ANNOTATION_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onColorChange(color)}
          data-testid={`color-${color}`}
          title={`Color ${color}`}
          style={{
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            backgroundColor: color,
            border: activeColor === color ? '3px solid #f8fafc' : '2px solid #334155',
            cursor: 'pointer',
            padding: 0,
          }}
          aria-label={`Color ${color}`}
        />
      ))}
    </div>
  );
}
