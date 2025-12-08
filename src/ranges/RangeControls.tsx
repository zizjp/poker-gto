import React, { useRef } from 'react';
import type { Action, RangeData } from './types';

interface RangeControlsProps {
  editMode: boolean;
  onEditModeChange: (value: boolean) => void;
  selectedAction: Action;
  onActionChange: (action: Action) => void;
  rangeData: RangeData;
  onRangeDataChange: (data: RangeData) => void;
}

export const RangeControls: React.FC<RangeControlsProps> = ({
  editMode,
  onEditModeChange,
  selectedAction,
  onActionChange,
  rangeData,
  onRangeDataChange,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleToggleEdit = (): void => {
    onEditModeChange(!editMode);
  };

  const handleImportClick = (): void => {
    fileInputRef.current?.click();
  };

  const handleFileChange: React.ChangeEventHandler<HTMLInputElement> = async (
    e,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text) as RangeData;
      onRangeDataChange(data);
    } catch (error) {
      // eslint-disable-next-line no-alert
      alert('Failed to import range JSON');
      // eslint-disable-next-line no-console
      console.error(error);
    } finally {
      e.target.value = '';
    }
  };

  const handleExportClick = (): void => {
    const blob = new Blob([JSON.stringify(rangeData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ranges_6max_export.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const actionButton = (action: Action, label: string): React.ReactElement => (
    <button
      key={action}
      type="button"
      className={[
        'range-controls__action',
        selectedAction === action ? 'range-controls__action--active' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={() => onActionChange(action)}
    >
      {label}
    </button>
  );

  return (
    <div className="range-controls">
      <div className="range-controls__section">
        <button
          type="button"
          className={[
            'range-controls__edit-toggle',
            editMode ? 'range-controls__edit-toggle--active' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          onClick={handleToggleEdit}
        >
          {editMode ? '編集中' : '編集モード'}
        </button>
      </div>

      <div className="range-controls__section">
        {actionButton('open', 'OPEN')}
        {actionButton('call', 'CALL')}
        {actionButton('jam', 'JAM')}
        {actionButton('fold', 'FOLD')}
      </div>

      <div className="range-controls__section">
        <button
          type="button"
          className="range-controls__btn"
          onClick={handleImportClick}
        >
          Import JSON
        </button>
        <button
          type="button"
          className="range-controls__btn"
          onClick={handleExportClick}
        >
          Export JSON
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          className="range-controls__file-input"
          onChange={handleFileChange}
        />
      </div>
    </div>
  );
};
