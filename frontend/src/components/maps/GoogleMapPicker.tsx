import { useState, useCallback, useRef, useEffect } from 'react';
import { GoogleMap, useJsApiLoader, Marker, Autocomplete } from '@react-google-maps/api';
import { Loader2, MapPin, Search, AlertTriangle, Edit } from '../../lib/lucide';

const libraries: ("places")[] = ['places'];

const mapContainerStyle = {
  width: '100%',
  height: '350px',
  borderRadius: 'var(--radius-lg)',
};

const defaultCenter = {
  lat: 41.0082, // Istanbul
  lng: 28.9784,
};

interface GoogleMapPickerProps {
  onLocationSelect: (location: {
    lat: number;
    lng: number;
    address?: string;
    city?: string;
    district?: string;
  }) => void;
  initialLat?: number;
  initialLng?: number;
  apiKey?: string;
}

// Manual coordinate input fallback component
function ManualCoordinateInput({ 
  onLocationSelect, 
  initialLat, 
  initialLng 
}: {
  onLocationSelect: GoogleMapPickerProps['onLocationSelect'];
  initialLat?: number;
  initialLng?: number;
}) {
  const [lat, setLat] = useState(initialLat?.toString() || '');
  const [lng, setLng] = useState(initialLng?.toString() || '');
  const [address, setAddress] = useState('');

  const handleApply = () => {
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    
    if (!isNaN(latNum) && !isNaN(lngNum)) {
      onLocationSelect({
        lat: latNum,
        lng: lngNum,
        address: address || undefined,
      });
    }
  };

  const openInGoogleMaps = () => {
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    if (!isNaN(latNum) && !isNaN(lngNum)) {
      window.open(`https://www.google.com/maps?q=${latNum},${lngNum}`, '_blank');
    }
  };

  return (
    <div style={{
      width: '100%',
      background: 'var(--bg-tertiary)',
      borderRadius: 'var(--radius-lg)',
      border: '2px dashed var(--border-primary)',
      padding: 'var(--space-6)',
    }}>
      <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: 'var(--radius-full)',
          background: 'linear-gradient(135deg, var(--warning-100) 0%, var(--warning-200) 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto var(--space-4)',
        }}>
          <AlertTriangle className="h-8 w-8" style={{ color: 'var(--warning-600)' }} />
        </div>
        <h3 style={{ 
          margin: '0 0 var(--space-2)', 
          fontSize: 'var(--text-lg)', 
          fontWeight: 'var(--font-semibold)',
          color: 'var(--text-primary)'
        }}>
          Harita Kullanılamıyor
        </h3>
        <p style={{ 
          margin: 0, 
          color: 'var(--text-secondary)', 
          fontSize: 'var(--text-sm)',
          maxWidth: '350px',
          marginLeft: 'auto',
          marginRight: 'auto',
        }}>
          Google Maps API etkin değil. Koordinatları manuel olarak girebilir veya Google Maps'ten kopyalayabilirsiniz.
        </p>
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr', 
        gap: 'var(--space-4)',
        marginBottom: 'var(--space-4)',
      }}>
        <div>
          <label style={{ 
            display: 'block', 
            fontSize: 'var(--text-sm)', 
            fontWeight: 'var(--font-medium)', 
            color: 'var(--text-secondary)',
            marginBottom: 'var(--space-2)'
          }}>
            Enlem (Latitude)
          </label>
          <input
            type="text"
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            placeholder="41.0082"
            style={{
              width: '100%',
              padding: 'var(--space-3)',
              border: '1.5px solid var(--border-primary)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-primary)',
              fontSize: 'var(--text-sm)',
              fontFamily: 'monospace',
            }}
          />
        </div>
        <div>
          <label style={{ 
            display: 'block', 
            fontSize: 'var(--text-sm)', 
            fontWeight: 'var(--font-medium)', 
            color: 'var(--text-secondary)',
            marginBottom: 'var(--space-2)'
          }}>
            Boylam (Longitude)
          </label>
          <input
            type="text"
            value={lng}
            onChange={(e) => setLng(e.target.value)}
            placeholder="28.9784"
            style={{
              width: '100%',
              padding: 'var(--space-3)',
              border: '1.5px solid var(--border-primary)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-primary)',
              fontSize: 'var(--text-sm)',
              fontFamily: 'monospace',
            }}
          />
        </div>
      </div>

      <div style={{ marginBottom: 'var(--space-4)' }}>
        <label style={{ 
          display: 'block', 
          fontSize: 'var(--text-sm)', 
          fontWeight: 'var(--font-medium)', 
          color: 'var(--text-secondary)',
          marginBottom: 'var(--space-2)'
        }}>
          Adres (Opsiyonel)
        </label>
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Tam adres..."
          style={{
            width: '100%',
            padding: 'var(--space-3)',
            border: '1.5px solid var(--border-primary)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-primary)',
            fontSize: 'var(--text-sm)',
          }}
        />
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center' }}>
        <button
          type="button"
          onClick={handleApply}
          disabled={!lat || !lng}
          style={{
            padding: 'var(--space-3) var(--space-6)',
            background: 'var(--primary-500)',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--text-sm)',
            fontWeight: 'var(--font-medium)',
            cursor: 'pointer',
            opacity: !lat || !lng ? 0.5 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
          }}
        >
          <MapPin className="h-4 w-4" />
          Koordinatları Uygula
        </button>
        {lat && lng && (
          <button
            type="button"
            onClick={openInGoogleMaps}
            style={{
              padding: 'var(--space-3) var(--space-4)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-primary)',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--text-sm)',
              cursor: 'pointer',
            }}
          >
            Haritada Gör →
          </button>
        )}
      </div>

      <div style={{ 
        marginTop: 'var(--space-4)', 
        padding: 'var(--space-3)',
        background: 'var(--bg-secondary)',
        borderRadius: 'var(--radius-md)',
        fontSize: 'var(--text-xs)',
        color: 'var(--text-tertiary)',
      }}>
        <strong>İpucu:</strong> Google Maps'te bir konuma sağ tıklayıp koordinatları kopyalayabilirsiniz.
      </div>
    </div>
  );
}

export function GoogleMapPicker({ 
  onLocationSelect, 
  initialLat, 
  initialLng,
  apiKey 
}: GoogleMapPickerProps) {
  const mapApiKey = apiKey || import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
  const [useManualEntry, setUseManualEntry] = useState(false);
  const [runtimeError, setRuntimeError] = useState(false);
  
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: mapApiKey,
    libraries,
  });

  // Listen for Google Maps API errors (like BillingNotEnabledMapError)
  useEffect(() => {
    const handleGoogleMapsError = (event: ErrorEvent) => {
      if (event.message?.includes('Google Maps') || 
          event.message?.includes('BillingNotEnabled') ||
          event.message?.includes('ApiNotActivated') ||
          event.message?.includes('InvalidKeyMapError')) {
        console.warn('Google Maps API error detected, switching to manual entry');
        setRuntimeError(true);
      }
    };

    window.addEventListener('error', handleGoogleMapsError);
    return () => window.removeEventListener('error', handleGoogleMapsError);
  }, []);

  const [marker, setMarker] = useState<{ lat: number; lng: number } | null>(
    initialLat && initialLng ? { lat: initialLat, lng: initialLng } : null
  );
  const [searchValue, setSearchValue] = useState('');
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);

  const center = marker || defaultCenter;

  const onMapClick = useCallback(async (e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      setMarker({ lat, lng });

      // Reverse geocoding to get address
      try {
        const geocoder = new google.maps.Geocoder();
        const response = await geocoder.geocode({ location: { lat, lng } });
        
        if (response.results[0]) {
          const result = response.results[0];
          let city = '';
          let district = '';
          
          for (const component of result.address_components) {
            if (component.types.includes('administrative_area_level_1')) {
              city = component.long_name;
            }
            if (component.types.includes('administrative_area_level_2') || 
                component.types.includes('locality')) {
              district = component.long_name;
            }
          }

          onLocationSelect({
            lat,
            lng,
            address: result.formatted_address,
            city,
            district,
          });
        } else {
          onLocationSelect({ lat, lng });
        }
      } catch (error) {
        console.error('Geocoding error:', error);
        onLocationSelect({ lat, lng });
      }
    }
  }, [onLocationSelect]);

  const onPlaceSelect = useCallback(() => {
    if (autocompleteRef.current) {
      const place = autocompleteRef.current.getPlace();
      
      if (place.geometry?.location) {
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        
        setMarker({ lat, lng });
        mapRef.current?.panTo({ lat, lng });
        mapRef.current?.setZoom(16);

        let city = '';
        let district = '';
        
        if (place.address_components) {
          for (const component of place.address_components) {
            if (component.types.includes('administrative_area_level_1')) {
              city = component.long_name;
            }
            if (component.types.includes('administrative_area_level_2') || 
                component.types.includes('locality')) {
              district = component.long_name;
            }
          }
        }

        onLocationSelect({
          lat,
          lng,
          address: place.formatted_address,
          city,
          district,
        });
      }
    }
  }, [onLocationSelect]);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  // No API key - show manual entry
  if (!mapApiKey) {
    return (
      <ManualCoordinateInput 
        onLocationSelect={onLocationSelect}
        initialLat={initialLat}
        initialLng={initialLng}
      />
    );
  }

  // User chose manual entry
  if (useManualEntry) {
    return (
      <div>
        <ManualCoordinateInput 
          onLocationSelect={onLocationSelect}
          initialLat={initialLat}
          initialLng={initialLng}
        />
        <button
          type="button"
          onClick={() => setUseManualEntry(false)}
          style={{
            marginTop: 'var(--space-3)',
            padding: 'var(--space-2) var(--space-4)',
            background: 'transparent',
            color: 'var(--primary-600)',
            border: 'none',
            fontSize: 'var(--text-sm)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
          }}
        >
          ← Haritaya Dön
        </button>
      </div>
    );
  }

  // Load error - show manual entry with option
  // Load error or runtime error (like billing issues)
  if (loadError || runtimeError) {
    return (
      <div>
        <ManualCoordinateInput
          onLocationSelect={onLocationSelect}
          initialLat={initialLat}
          initialLng={initialLng}
        />
      </div>
    );
  }

  // Loading
  if (!isLoaded) {
    return (
      <div style={{
        width: '100%',
        height: '350px',
        background: 'var(--bg-tertiary)',
        borderRadius: 'var(--radius-lg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 'var(--space-2)'
      }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--color-primary)' }} />
        <p style={{ color: 'var(--text-secondary)' }}>Harita yükleniyor...</p>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      {/* Manual Entry Toggle */}
      <button
        type="button"
        onClick={() => setUseManualEntry(true)}
        style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          zIndex: 10,
          padding: 'var(--space-2) var(--space-3)',
          background: 'white',
          border: '1px solid var(--border-primary)',
          borderRadius: 'var(--radius-md)',
          fontSize: 'var(--text-xs)',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-1)',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        }}
      >
        <Edit className="h-3 w-3" />
        Manuel Giriş
      </button>

      {/* Search Box */}
      <div style={{ 
        position: 'absolute', 
        top: '10px', 
        left: '10px', 
        width: 'calc(100% - 120px)',
        zIndex: 10,
      }}>
        <Autocomplete
          onLoad={(autocomplete) => {
            autocompleteRef.current = autocomplete;
          }}
          onPlaceChanged={onPlaceSelect}
          options={{
            componentRestrictions: { country: 'tr' },
            types: ['geocode', 'establishment'],
          }}
        >
          <div style={{ position: 'relative' }}>
            <Search 
              className="h-4 w-4" 
              style={{ 
                position: 'absolute', 
                left: '12px', 
                top: '50%', 
                transform: 'translateY(-50%)',
                color: 'var(--text-tertiary)',
                pointerEvents: 'none',
              }} 
            />
            <input
              type="text"
              placeholder="Adres veya konum ara..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 12px 12px 40px',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-primary)',
                background: 'white',
                fontSize: '0.875rem',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              }}
            />
          </div>
        </Autocomplete>
      </div>

      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={center}
        zoom={marker ? 16 : 12}
        onClick={onMapClick}
        onLoad={onMapLoad}
        onUnmount={() => {
          mapRef.current = null;
        }}
        options={{
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: true,
          zoomControl: true,
        }}
      >
        {marker && (
          <Marker 
            position={marker}
            animation={google.maps.Animation.DROP}
          />
        )}
      </GoogleMap>

      {marker && (
        <div style={{
          marginTop: 'var(--space-2)',
          padding: 'var(--space-2) var(--space-3)',
          background: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-md)',
          fontSize: '0.75rem',
          color: 'var(--text-secondary)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
        }}>
          <MapPin className="h-3 w-3" />
          <span>Koordinatlar: {marker.lat.toFixed(6)}, {marker.lng.toFixed(6)}</span>
        </div>
      )}
    </div>
  );
}
