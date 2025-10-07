import React, { useState, useEffect } from 'react';
import { audioService, AudioSettings } from '../services/audioService';

interface AudioControlsProps {
  isOpen: boolean;
  onClose: () => void;
}

const AudioControls: React.FC<AudioControlsProps> = ({ isOpen, onClose }) => {
  const [settings, setSettings] = useState<AudioSettings>(audioService.getSettings());

  useEffect(() => {
    setSettings(audioService.getSettings());
  }, [isOpen]);

  const handleSettingChange = (key: keyof AudioSettings, value: number | boolean) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    audioService.updateSettings(newSettings);
  };

  const testSound = (soundType: string) => {
    switch (soundType) {
      case 'slot-spin':
        audioService.playSlotSpin();
        break;
      case 'win':
        audioService.playBigWin();
        break;
      case 'jackpot':
        audioService.playJackpot();
        break;
      case 'card':
        audioService.playCardFlip();
        break;
      case 'dice':
        audioService.playDiceRoll();
        break;
      case 'click':
        audioService.playButtonClick();
        break;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gradient-to-br from-purple-900 to-indigo-900 rounded-xl border-2 border-purple-500 p-6 w-96 max-w-90vw">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-casino-gold">🔊 Audio Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl"
          >
            ×
          </button>
        </div>

        {/* Master Enable/Disable */}
        <div className="mb-6">
          <label className="flex items-center space-x-3 text-white cursor-pointer">
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(e) => handleSettingChange('enabled', e.target.checked)}
              className="w-5 h-5 text-casino-gold rounded focus:ring-casino-gold"
            />
            <span className="text-lg">Enable Audio</span>
          </label>
        </div>

        {settings.enabled && (
          <>
            {/* Master Volume */}
            <div className="mb-6">
              <label className="block text-white mb-2">
                Master Volume: {Math.round(settings.masterVolume * 100)}%
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={settings.masterVolume}
                onChange={(e) => handleSettingChange('masterVolume', parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
              />
            </div>

            {/* Sound Effects Volume */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <label className="text-white">
                  Sound Effects: {Math.round(settings.sfxVolume * 100)}%
                </label>
                <button
                  onClick={() => testSound('click')}
                  className="text-casino-gold hover:text-casino-accent text-sm px-2 py-1 border border-casino-gold rounded"
                >
                  Test
                </button>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={settings.sfxVolume}
                onChange={(e) => handleSettingChange('sfxVolume', parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
              />
            </div>

            {/* Background Music Volume */}
            <div className="mb-6">
              <label className="block text-white mb-2">
                Background Music: {Math.round(settings.musicVolume * 100)}%
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={settings.musicVolume}
                onChange={(e) => handleSettingChange('musicVolume', parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
              />
            </div>

            {/* Sound Tests */}
            <div className="border-t border-purple-500 pt-4">
              <h3 className="text-white mb-3">Test Sounds:</h3>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => testSound('slot-spin')}
                  className="casino-button-secondary px-3 py-2 text-sm"
                >
                  🎰 Slot Spin
                </button>
                <button
                  onClick={() => testSound('win')}
                  className="casino-button-secondary px-3 py-2 text-sm"
                >
                  🎉 Win
                </button>
                <button
                  onClick={() => testSound('jackpot')}
                  className="casino-button-secondary px-3 py-2 text-sm"
                >
                  💰 Jackpot
                </button>
                <button
                  onClick={() => testSound('card')}
                  className="casino-button-secondary px-3 py-2 text-sm"
                >
                  🃏 Card Flip
                </button>
                <button
                  onClick={() => testSound('dice')}
                  className="casino-button-secondary px-3 py-2 text-sm"
                >
                  🎲 Dice Roll
                </button>
                <button
                  onClick={() => testSound('click')}
                  className="casino-button-secondary px-3 py-2 text-sm"
                >
                  🔘 Button
                </button>
              </div>
            </div>
          </>
        )}

        <div className="mt-6 text-center">
          <button
            onClick={onClose}
            className="casino-button px-6 py-2"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default AudioControls;