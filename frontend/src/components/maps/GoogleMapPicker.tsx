import { useState, useCallback, useRef } from 'react';
import { GoogleMap, useJsApiLoader, Marker, Autocomplete } from '@react-google-maps/api';
import { Loader2, MapPin, Search } from '../../lib/lucide';

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

export function GoogleMapPicker({ 
  onLocationSelect, 
  initialLat, 
  initialLng,
  apiKey 
}: GoogleMapPickerProps) {
  const mapApiKey = apiKey || import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
  
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: mapApiKey,
    libraries,
  });

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

  if (!mapApiKey) {
    return (
      <div style={{
        width: '100%',
        height: '350px',
        background: 'var(--bg-tertiary)',
        borderRadius: 'var(--radius-lg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '2px dashed var(--border-primary)',
        flexDirection: 'column',
        gap: 'var(--space-2)'
      }}>
        <MapPin className="h-12 w-12" style={{ color: 'var(--text-tertiary)' }} />
        <p style={{ color: 'var(--text-tertiary)', textAlign: 'center', maxWidth: '250px' }}>
          Google Maps API key yapılandırılmamış. Lütfen Vercel Environment Variables'a ekleyin.
        </p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={{
        width: '100%',
        height: '350px',
        background: '#fef2f2',
        borderRadius: 'var(--radius-lg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '2px dashed #dc2626',
        flexDirection: 'column',
        gap: 'var(--space-2)'
      }}>
        <MapPin className="h-12 w-12" style={{ color: '#dc2626' }} />
        <p style={{ color: '#dc2626', textAlign: 'center', maxWidth: '250px' }}>
          Harita yüklenirken hata oluştu. API key'i kontrol edin.
        </p>
      </div>
    );
  }

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
      {/* Search Box */}
      <div style={{ 
        position: 'absolute', 
        top: '10px', 
        left: '10px', 
        right: '10px',
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
