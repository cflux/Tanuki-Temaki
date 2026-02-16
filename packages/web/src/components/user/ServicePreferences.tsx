import React, { useEffect, useState } from 'react';
import { userApi, seriesApi } from '../../lib/api';
import { STATUS_DISPLAY_DURATION } from '../../config/uiConstants';

interface ServicePreferencesProps {
  userId: string;
}

export const ServicePreferences: React.FC<ServicePreferencesProps> = ({ userId }) => {
  const [allServices, setAllServices] = useState<string[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const [services, userServices] = await Promise.all([
          seriesApi.getAllServices(),
          userApi.getAvailableServices(),
        ]);

        console.log('Loaded all services:', services);
        console.log('Loaded user services:', userServices);
        console.log('User services type:', typeof userServices, Array.isArray(userServices));

        setAllServices(services);
        setSelectedServices(userServices);
      } catch (error) {
        console.error('Failed to load services:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [userId]);

  const handleToggleService = (service: string) => {
    setSelectedServices((prev) =>
      prev.includes(service)
        ? prev.filter((s) => s !== service)
        : [...prev, service]
    );
  };

  const handleSave = async () => {
    console.log('Saving services:', selectedServices);
    setIsSaving(true);
    setSaveStatus('saving');

    try {
      await userApi.setAvailableServices(selectedServices);
      console.log('Services saved successfully');
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), STATUS_DISPLAY_DURATION.SUCCESS);
    } catch (error) {
      console.error('Failed to save service preferences:', error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), STATUS_DISPLAY_DURATION.ERROR);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin h-8 w-8 border-2 border-cyber-border border-t-cyber-accent"></div>
      </div>
    );
  }

  // Categorize services (very basic heuristic)
  const streamingServices = allServices.filter(s => {
    const lower = s.toLowerCase();
    // Exclude manga services
    if (lower.includes('manga') || lower.includes('comic') || lower.includes('viz')) {
      return false;
    }
    return (
      lower.includes('crunchyroll') ||
      lower.includes('netflix') ||
      lower.includes('hulu') ||
      lower.includes('funimation') ||
      lower.includes('hidive') ||
      lower.includes('anime')
    );
  });

  const readingServices = allServices.filter(s => {
    const lower = s.toLowerCase();
    return (
      lower.includes('manga') ||
      lower.includes('viz') ||
      lower.includes('comic') ||
      lower.includes('kodansha') ||
      lower.includes('kindle') ||
      lower.includes('bookwalker')
    );
  });

  const otherServices = allServices.filter(
    s => !streamingServices.includes(s) && !readingServices.includes(s)
  );

  // Get service homepage URL
  const getServiceUrl = (service: string): string | null => {
    const lower = service.toLowerCase();
    if (lower.includes('crunchyroll') && !lower.includes('manga')) return 'https://www.crunchyroll.com';
    if (lower.includes('crunchyroll') && lower.includes('manga')) return 'https://www.crunchyroll.com/comics';
    if (lower.includes('netflix')) return 'https://www.netflix.com';
    if (lower.includes('hulu')) return 'https://www.hulu.com';
    if (lower.includes('amazon') || lower.includes('prime')) return 'https://www.amazon.com/primevideo';
    if (lower.includes('disney')) return 'https://www.disneyplus.com';
    if (lower.includes('hbo') || lower.includes('max')) return 'https://www.max.com';
    if (lower.includes('funimation')) return 'https://www.funimation.com';
    if (lower.includes('hidive')) return 'https://www.hidive.com';
    if (lower.includes('viz')) return 'https://www.viz.com';
    if (lower.includes('manga plus') || lower.includes('mangaplus')) return 'https://mangaplus.shueisha.co.jp';
    if (lower.includes('comixology')) return 'https://www.comixology.com';
    if (lower.includes('bookwalker')) return 'https://global.bookwalker.jp';
    if (lower.includes('kodansha')) return 'https://kodansha.us';
    if (lower.includes('k manga')) return 'https://kmanga.kodansha.com';
    return null;
  };

  const ServiceCheckbox: React.FC<{ service: string }> = ({ service }) => {
    const url = getServiceUrl(service);

    return (
      <div className="flex items-center gap-1">
        <label
          key={service}
          className="flex items-center gap-2 p-2 bg-cyber-bg-card border border-cyber-border cursor-pointer hover:border-cyber-accent transition-colors flex-1"
        >
          <input
            type="checkbox"
            checked={selectedServices.includes(service)}
            onChange={() => handleToggleService(service)}
            className="w-3.5 h-3.5 border-cyber-border bg-cyber-bg text-cyber-accent focus:ring-cyber-accent focus:ring-offset-cyber-bg flex-shrink-0 accent-cyber-accent"
          />
          <span className="text-xs text-cyber-text leading-tight uppercase tracking-wide">{service}</span>
        </label>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 bg-cyber-bg-card border border-cyber-border hover:border-cyber-accent transition-colors text-cyber-text-dim hover:text-cyber-accent"
            title={`Visit ${service}`}
            onClick={(e) => e.stopPropagation()}
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2 text-cyber-text-bright uppercase tracking-wider border-b border-cyber-border pb-2">SERVICE PREFERENCES</h3>
        <p className="text-sm text-cyber-text-dim font-mono">
          SELECT YOUR STREAMING AND READING PLATFORMS TO PERSONALIZE RECOMMENDATIONS.
        </p>
      </div>

      {/* Anime Streaming */}
      {streamingServices.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2 text-cyber-text uppercase tracking-wider">ANIME STREAMING</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1.5">
            {streamingServices.map((service) => (
              <ServiceCheckbox key={service} service={service} />
            ))}
          </div>
        </div>
      )}

      {/* Manga Reading */}
      {readingServices.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2 text-cyber-text uppercase tracking-wider">MANGA READING</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1.5">
            {readingServices.map((service) => (
              <ServiceCheckbox key={service} service={service} />
            ))}
          </div>
        </div>
      )}

      {/* Other Services */}
      {otherServices.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2 text-cyber-text uppercase tracking-wider">OTHER PLATFORMS</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1.5">
            {otherServices.map((service) => (
              <ServiceCheckbox key={service} service={service} />
            ))}
          </div>
        </div>
      )}

      {allServices.length === 0 && (
        <p className="text-cyber-text-dim text-sm font-mono uppercase tracking-wide">
          NO SERVICES FOUND YET. SERVICES WILL APPEAR AS YOU BROWSE SERIES.
        </p>
      )}

      {/* Save Button */}
      <div className="flex items-center gap-3 pt-4 border-t border-cyber-border">
        <div className="inline-flex" style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}>
          <div className="bg-cyber-accent p-[1px]" style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-2 bg-cyber-bg border border-cyber-accent text-cyber-accent hover:bg-cyber-accent hover:text-cyber-bg font-medium transition-all disabled:border-cyber-border-dim disabled:text-cyber-text-dim disabled:cursor-not-allowed uppercase tracking-wider shadow-cyber-md hover:shadow-cyber-lg"
              style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}
            >
              {saveStatus === 'saving' ? 'SAVING...' : 'SAVE PREFERENCES'}
            </button>
          </div>
        </div>

        {saveStatus === 'saved' && (
          <span className="text-sm text-cyber-accent flex items-center gap-1 uppercase tracking-wide">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            SAVED!
          </span>
        )}

        {saveStatus === 'error' && (
          <span className="text-sm text-red-500 uppercase tracking-wide">FAILED TO SAVE</span>
        )}

        <div className="flex-1"></div>

        <span className="text-sm text-cyber-text-dim font-mono uppercase tracking-wide">
          {selectedServices.length} SERVICE{selectedServices.length !== 1 ? 'S' : ''} SELECTED
        </span>
      </div>
    </div>
  );
};
