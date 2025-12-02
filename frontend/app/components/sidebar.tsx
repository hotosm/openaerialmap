import type WaSelect from '@awesome.me/webawesome/dist/components/select/select.js';
import type { WaSelectionChangeEvent } from '@awesome.me/webawesome/dist/webawesome.js';

import '@awesome.me/webawesome/dist/components/drawer/drawer.js';
import '@awesome.me/webawesome/dist/components/button/button.js';
import '@awesome.me/webawesome/dist/components/copy-button/copy-button.js';
import '@awesome.me/webawesome/dist/components/spinner/spinner.js';
import '@awesome.me/webawesome/dist/components/icon/icon.js';
import '@awesome.me/webawesome/dist/components/select/select.js';
import '@awesome.me/webawesome/dist/components/option/option.js';
import '@awesome.me/webawesome/dist/components/dialog/dialog.js';
import '@awesome.me/webawesome/dist/components/input/input.js';

import { useEffect, useState } from 'react';
import { useStac } from '../context/StacContext';
import { useAuth } from '../context/AuthContext';
import { StacFeatureCollection } from '../types/stac';

function CollectionDropdown() {
  const { availableCollections, handleSelectCollection } = useStac();
  const [collection, setCollection] = useState<string>();
  const [dialogOpen, setDialogOpen] = useState(false);

  if (!availableCollections) return null;

  const collectionChanged = (event: WaSelectionChangeEvent) => {
    const select = event.target as WaSelect;
    if (select && select.value) {
      const value = Array.isArray(select.value)
        ? select.value[0]
        : select.value;
      handleSelectCollection(value);
      setCollection(value);
    }
  };

  const collectionWmtsEndpoint =
    (collection &&
      `${import.meta.env.VITE_STAC_API_URL}/raster/collections/${collection}/WebMercatorQuad/WMTSCapabilities.xml?minzoom=12&maxzoom=22&assets=visual`) ||
    undefined;

  return (
    <div>
      <wa-select
        placeholder='Select a collection'
        size='medium'
        style={{ width: '100%' }}
        onChange={collectionChanged}
      >
        {availableCollections.map((collection) => (
          <wa-option key={`collection-${collection.id}`} value={collection.id}>
            {collection.title}
          </wa-option>
        ))}
      </wa-select>
      {collectionWmtsEndpoint && (
        <wa-button
          style={{ marginTop: '1em', marginBottom: '1em' }}
          onClick={() => setDialogOpen(true)}
        >
          Get WMTS endpoint
        </wa-button>
      )}
      <wa-dialog
        label='WMTS endpoint'
        open={dialogOpen}
        wa-after-hide={() => setDialogOpen(false)}
        style={{ '--width': '50vw' }}
      >
        {collectionWmtsEndpoint}
        <wa-copy-button value={collectionWmtsEndpoint} />
        <wa-button
          slot='footer'
          variant='primary'
          onClick={() => setDialogOpen(false)}
        >
          Close
        </wa-button>
      </wa-dialog>
    </div>
  );
}

interface SelectableItemsProps {
  stacItems: StacFeatureCollection;
  onSelectionChange: (selectedId: string) => void;
  isDetailPaneShown: boolean;
  setShowDetailPane: (isShown: boolean) => void;
}

function SelectableItems({
  stacItems,
  onSelectionChange,
  isDetailPaneShown,
  setShowDetailPane
}: SelectableItemsProps) {
  const [selectedItem, setSelectedItem] = useState<string>();

  // Update parent when local selection changes
  useEffect(() => {
    if (selectedItem) {
      onSelectionChange(selectedItem);
    }
  }, [selectedItem, onSelectionChange]);

  const handleItemClick = (itemId: string) => {
    setSelectedItem(itemId);
  };

  const renderThumbnail = (url: string, altText: string) => {
    if (!url) return null;

    return (
      <div style={{ height: '200px', width: '100%', overflow: 'hidden' }}>
        <img
          src={url}
          alt={altText}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover'
          }}
        />
      </div>
    );
  };

  return (
    <div style={{ marginTop: '1.5rem' }}>
      <h3
        style={{
          fontSize: '0.875rem',
          fontWeight: '600',
          marginBottom: '0.75rem'
        }}
      >
        Latest uploads
      </h3>

      <wa-button
        variant='primary'
        onClick={() => setShowDetailPane(isDetailPaneShown ? false : true)}
      >
        {isDetailPaneShown ? 'Hide' : 'Show'} selected item details
      </wa-button>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '1rem',
          marginTop: '1rem'
        }}
      >
        {stacItems.features.map((stacItem) => {
          const startDate = stacItem.properties?.start_datetime
            ? new Date(stacItem.properties.start_datetime)
                .toISOString()
                .split('T')[0]
            : 'No date';

          // Format ground sampling distance (GSD) to include units
          const resolution = stacItem.properties?.gsd
            ? `${Math.round(stacItem.properties.gsd * 100)} cm`
            : 'Unknown';

          const producerName =
            (stacItem.properties?.['oam:producer_name'] as string) ||
            'Unknown producer';

          const title = stacItem.properties?.title || `Item ${stacItem.id}`;

          const thumbnailUrl = stacItem.assets?.thumbnail?.href || '';

          return (
            <div
              key={`STAC-item-${stacItem.id}`}
              style={{
                border: '1px solid',
                borderRadius: '0.375rem',
                overflow: 'hidden',
                backgroundColor: '#f7fafc',
                borderColor:
                  selectedItem === stacItem.id ? '#e53e3e' : '#e2e8f0'
              }}
            >
              <div
                style={{
                  padding: '0.75rem',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
                onClick={() => handleItemClick(stacItem.id)}
              >
                <div>
                  <span style={{ fontWeight: '600', fontSize: '0.875rem' }}>
                    {title}
                  </span>
                  <div style={{ fontSize: '0.875rem' }}>
                    {startDate} / {resolution}
                  </div>
                  <span style={{ fontSize: '0.875rem', color: '#3182ce' }}>
                    {producerName}
                  </span>
                </div>
                <wa-icon
                  name='info-square'
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    setShowDetailPane(isDetailPaneShown ? false : true);
                  }}
                />
              </div>

              {renderThumbnail(thumbnailUrl, title)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FilterComponent() {
  const { filters, handleSetFilter } = useStac();

  const handleDatePresetChange = (event: WaSelectionChangeEvent) => {
    const select = event.target as WaSelect;
    const preset = select.value as string;

    let startDate = '';
    let endDate = '';

    const today = new Date();
    const formatDate = (date: Date) => date.toISOString().split('T')[0];

    switch (preset) {
      case 'last-week': {
        const lastWeek = new Date(today);
        lastWeek.setDate(today.getDate() - 7);
        startDate = formatDate(lastWeek);
        endDate = formatDate(today);
        break;
      }
      case 'last-month': {
        const lastMonth = new Date(today);
        lastMonth.setMonth(today.getMonth() - 1);
        startDate = formatDate(lastMonth);
        endDate = formatDate(today);
        break;
      }
      case 'last-year': {
        const lastYear = new Date(today);
        lastYear.setFullYear(today.getFullYear() - 1);
        startDate = formatDate(lastYear);
        endDate = formatDate(today);
        break;
      }
      case 'all':
      default:
        startDate = '';
        endDate = '';
        break;
    }

    handleSetFilter({
      ...filters,
      dateFilter: {
        startDate,
        endDate
      }
    });
  };

  return (
    <div>
      <wa-input
        label='Item ID'
        value={filters['itemIdFilter'].itemId || ''}
        placeholder='Item ID...'
        onChange={(e: any) => {
          handleSetFilter({
            ...filters,
            itemIdFilter: { itemId: (e.target as HTMLInputElement).value }
          });
        }}
      />
      <wa-select
        label='Date Presets'
        placeholder='Select date range...'
        size='medium'
        style={{ width: '100%', marginBottom: '0.5rem' }}
        onChange={handleDatePresetChange}
      >
        <wa-option value='all'>All</wa-option>
        <wa-option value='last-week'>Last Week</wa-option>
        <wa-option value='last-month'>Last Month</wa-option>
        <wa-option value='last-year'>Last Year</wa-option>
      </wa-select>
      <wa-input
        label='Start'
        type='date'
        value={filters['dateFilter'].startDate || undefined}
        placeholder='Start...'
        onChange={(e: any) => {
          handleSetFilter({
            ...filters,
            dateFilter: {
              ...filters['dateFilter'],
              startDate: (e.target as HTMLInputElement).value
            }
          });
        }}
      />
      <wa-input
        label='End'
        type='date'
        value={filters['dateFilter'].endDate || undefined}
        placeholder='End...'
        onChange={(e: any) => {
          handleSetFilter({
            ...filters,
            dateFilter: {
              ...filters['dateFilter'],
              endDate: (e.target as HTMLInputElement).value
            }
          });
        }}
      />
      {/* <wa-button variant='primary'>Filter</wa-button> */}
    </div>
  );
}

interface SidebarProps {
  isDetailPaneShown: boolean;
  setShowDetailPane: (isShown: boolean) => void;
}

export default function Sidebar({
  isDetailPaneShown,
  setShowDetailPane
}: SidebarProps) {
  const {
    selectedCollection,
    availableCollections,
    isStacCollectionLoading,
    isStacCollectionsError,
    isStacItemsLoading,
    isStacItemsError,
    stacItems,
    setSelectedItem
  } = useStac();

  const hankoUrl = import.meta.env.VITE_HANKO_URL || 'https://login.hotosm.test';
  const loginServiceUrl = import.meta.env.VITE_LOGIN_URL || 'https://login.hotosm.test';

  return (
    <div
      style={{
        width: '450px',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        padding: '1rem',
        overflow: 'auto',
        borderRight: '1px solid #e2e8f0'
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem'
        }}
      >
        <h2
          style={{
            fontSize: '1.25rem',
            fontWeight: 'bold',
            margin: 0
          }}
        >
          OpenAerialMap
        </h2>
        <hotosm-auth
          hanko-url={hankoUrl}
          auth-service-url={loginServiceUrl}
          show-profile={false}
          redirect-url="https://openaerialmap.hotosm.test"
        />
      </div>

      {isStacCollectionLoading && <wa-spinner />}

      {isStacCollectionsError && <span>Failed to load STAC catalog</span>}

      {availableCollections && availableCollections.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'stretch'
          }}
        >
          <div>
            <span style={{ fontWeight: 'bold' }}>Collections:</span>
            <div style={{ marginTop: '0.5rem' }}>
              <CollectionDropdown />
            </div>
          </div>
        </div>
      )}

      {selectedCollection && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'stretch'
          }}
        >
          <div>
            <span style={{ fontWeight: 'bold' }}>Filter:</span>
            <div style={{ marginTop: '0.5rem' }}>
              <FilterComponent />
            </div>
          </div>
        </div>
      )}

      {isStacItemsLoading && <wa-spinner />}

      {isStacItemsError && <span>Failed to load STAC items</span>}

      {stacItems && stacItems.features && stacItems.features.length > 0 && (
        <SelectableItems
          stacItems={stacItems}
          onSelectionChange={setSelectedItem}
          isDetailPaneShown={isDetailPaneShown}
          setShowDetailPane={setShowDetailPane}
        />
      )}
    </div>
  );
}
