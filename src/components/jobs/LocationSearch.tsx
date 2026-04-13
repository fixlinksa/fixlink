'use client';

import React from 'react';
import { MapPin, Navigation } from 'lucide-react';
import { cn } from '@/lib/utils';
import Autocomplete from "react-google-autocomplete";

interface LocationSearchProps {
  onLocationSelect: (address: string, lat: number, lng: number) => void;
  className?: string;
  placeholder?: string;
  defaultValue?: string;
}

export default function LocationSearch({ onLocationSelect, className, placeholder = "Search location...", defaultValue }: LocationSearchProps) {
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
           }
        }}
        options={{
          componentRestrictions: { country: 'za' },
          fields: ['address_components', 'geometry', 'formatted_address'],
          types: ["address"],
        }}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="w-full pl-14 pr-14 py-5 bg-white rounded-2xl border border-border shadow-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-medium text-foreground placeholder:text-muted-foreground relative"
      />
      <button 
        type="button"
        onClick={() => {
           if (navigator.geolocation) {
             navigator.geolocation.getCurrentPosition((position) => {
                console.log(position.coords.latitude, position.coords.longitude);
             });
           }
        }}
        className="absolute z-10 right-4 p-2 text-muted-foreground hover:text-primary transition-colors"
        title="Use current location"
      >
        <Navigation className="w-5 h-5" />
      </button>
    </div>
  );
}
