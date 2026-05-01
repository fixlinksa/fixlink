'use client';

import React, { useState, useRef } from 'react';
import { MapPin, Navigation, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import Autocomplete from "react-google-autocomplete";

interface LocationSearchProps {
  onLocationSelect: (address: string, lat: number, lng: number) => void;
  className?: string;
  placeholder?: string;
  defaultValue?: string;
  disabled?: boolean;
}

export default function LocationSearch({ onLocationSelect, className, placeholder = "Search location...", defaultValue, disabled }: LocationSearchProps) {
  const [inputValue, setInputValue] = useState(defaultValue || '');
  const [isGeocoding, setIsGeocoding] = useState(false);
  const autocompleteRef = useRef<any>(null);

  const handleManualSearch = async (text: string) => {
    if (!text || text.length < 3) return;
    
    setIsGeocoding(true);
    try {
      const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(text)}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&components=country:za`);
      const data = await response.json();
      
      if (data.results && data.results.length > 0) {
        const place = data.results[0];
        const { lat, lng } = place.geometry.location;
        onLocationSelect(place.formatted_address, lat, lng);
        setInputValue(place.formatted_address);
      }
    } catch (error) {
      console.error("Geocoding failed:", error);
    } finally {
      setIsGeocoding(false);
    }
  };

  return (
    <div className={cn("relative flex items-center group", className)}>
      <MapPin className="absolute z-10 left-6 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
      <Autocomplete 
        apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}
        onPlaceSelected={(place: any) => {
           if (place?.geometry?.location && place?.formatted_address) {
              const lat = place.geometry.location.lat();
              const lng = place.geometry.location.lng();
              onLocationSelect(place.formatted_address, lat, lng);
              setInputValue(place.formatted_address);
           }
        }}
        onChange={(e: any) => setInputValue(e.target.value)}
        onKeyDown={(e: any) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleManualSearch(inputValue);
          }
        }}
        options={{
          componentRestrictions: { country: 'za' },
          types: ['geocode', 'establishment'],
          fields: ['address_components', 'geometry', 'formatted_address'],
        }}
        defaultValue={defaultValue}
        placeholder={placeholder}
        disabled={disabled || isGeocoding}
        className={cn(
          "w-full pl-14 pr-14 py-5 bg-white rounded-2xl border border-border shadow-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-medium text-foreground placeholder:text-muted-foreground relative",
          (disabled || isGeocoding) && "opacity-70 cursor-not-allowed bg-slate-50"
        )}
      />
      <div className="absolute z-10 right-4 flex items-center gap-1">
        {isGeocoding ? (
          <Loader2 className="w-5 h-5 text-primary animate-spin mr-2" />
        ) : (
          <button 
            type="button"
            onClick={() => {
              if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition((position) => {
                    const { latitude, longitude } = position.coords;
                    handleManualSearch(`${latitude},${longitude}`);
                });
              }
            }}
            disabled={disabled || isGeocoding}
            className="p-2 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Use current location"
          >
            <Navigation className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
}
