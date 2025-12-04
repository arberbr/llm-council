import './RightSidebar.css';
import { useTheme } from '../context/ThemeContext';
import { useState, useEffect } from 'react';

// Common OpenRouter models - can be expanded
const AVAILABLE_MODELS = [
    { id: 'openai/gpt-5.1', name: 'GPT-5.1' },
    { id: 'google/gemini-3-pro-preview', name: 'Gemini 3 Pro' },
    { id: 'anthropic/claude-sonnet-4.5', name: 'Claude Sonnet 4.5' },
    { id: 'x-ai/grok-4', name: 'Grok 4' },
];

const DEFAULT_COUNCIL_MODELS = [
    'openai/gpt-5.1',
    'google/gemini-3-pro-preview',
    'anthropic/claude-sonnet-4.5',
    'x-ai/grok-4',
];

const DEFAULT_CHAIRMAN_MODEL = 'google/gemini-3-pro-preview';

export default function RightSidebar({ isVisible }) {
    const { theme, toggleTheme } = useTheme();
    const [councilModels, setCouncilModels] = useState(() => {
        const saved = localStorage.getItem('councilModels');
        return saved ? JSON.parse(saved) : DEFAULT_COUNCIL_MODELS;
    });
    const [chairmanModel, setChairmanModel] = useState(() => {
        const saved = localStorage.getItem('chairmanModel');
        return saved || DEFAULT_CHAIRMAN_MODEL;
    });
    const [openRouterApiKey, setOpenRouterApiKey] = useState(() => {
        const saved = localStorage.getItem('openRouterApiKey');
        return saved || '';
    });

    // Save to localStorage whenever settings change
    useEffect(() => {
        localStorage.setItem('councilModels', JSON.stringify(councilModels));
    }, [councilModels]);

    useEffect(() => {
        localStorage.setItem('chairmanModel', chairmanModel);
    }, [chairmanModel]);

    useEffect(() => {
        localStorage.setItem('openRouterApiKey', openRouterApiKey);
    }, [openRouterApiKey]);

    const handleCouncilModelToggle = (modelId) => {
        setCouncilModels((prev) => {
            if (prev.includes(modelId)) {
                // Remove if already selected (but keep at least 2)
                if (prev.length > 2) {
                    return prev.filter((id) => id !== modelId);
                }
                return prev;
            } else {
                // Add if not selected
                return [...prev, modelId];
            }
        });
    };

    // Validation helper
    const validateSettings = () => {
        const errors = [];

        if (!openRouterApiKey || !openRouterApiKey.trim()) {
            errors.push('OpenRouter API key is required');
        }

        if (!chairmanModel || !chairmanModel.trim()) {
            errors.push('Chairman model must be selected');
        }

        if (!councilModels || councilModels.length < 2) {
            errors.push('At least 2 council models must be selected');
        }

        return errors;
    };

    // Get validation errors for display
    const validationErrors = validateSettings();

    return (
        <div className={`right-sidebar ${!isVisible ? 'sidebar-hidden' : ''}`}>
            <div className="right-sidebar-content">
                {/* Theme Toggle */}
                <div className="settings-section">
                    <div className="settings-section-header">
                        <h3 className="settings-section-title">Theme</h3>
                    </div>
                    <button
                        className="theme-toggle"
                        onClick={toggleTheme}
                        title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
                    >
                        {theme === 'light' ? '🌙' : '☀️'}
                        <span className="theme-toggle-label">
                            {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
                        </span>
                    </button>
                </div>

                {/* OpenRouter API Key */}
                <div className="settings-section">
                    <div className="settings-section-header">
                        <h3 className="settings-section-title">OpenRouter API Key</h3>
                    </div>
                    <input
                        type="password"
                        value={openRouterApiKey}
                        onChange={(e) => setOpenRouterApiKey(e.target.value)}
                        placeholder="sk-or-v1-..."
                        className="api-key-input"
                    />
                </div>

                {/* Chairman Model Selection */}
                <div className="settings-section">
                    <div className="settings-section-header">
                        <h3 className="settings-section-title">Chairman Model</h3>
                    </div>
                    <select
                        value={chairmanModel}
                        onChange={(e) => setChairmanModel(e.target.value)}
                        className="chairman-select"
                    >
                        {AVAILABLE_MODELS.map((model) => (
                            <option key={model.id} value={model.id}>
                                {model.name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Council Models Selection */}
                <div className="settings-section">
                    <div className="settings-section-header">
                        <h3 className="settings-section-title">Council Models</h3>
                        <span className="settings-hint">(Select at least 2)</span>
                    </div>
                    <div className="model-selection-list">
                        {AVAILABLE_MODELS.map((model) => (
                            <label key={model.id} className="model-checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={councilModels.includes(model.id)}
                                    onChange={() => handleCouncilModelToggle(model.id)}
                                    className="model-checkbox"
                                />
                                <span className="model-checkbox-text">{model.name}</span>
                            </label>
                        ))}
                    </div>
                </div>

                {/* Validation Errors */}
                {validationErrors.length > 0 && (
                    <div className="settings-section validation-errors">
                        <div className="settings-section-header">
                            <h3 className="settings-section-title" style={{ color: '#ff4444' }}>
                                Configuration Required
                            </h3>
                        </div>
                        <ul className="validation-error-list">
                            {validationErrors.map((error, index) => (
                                <li key={index} className="validation-error-item">
                                    {error}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
}

