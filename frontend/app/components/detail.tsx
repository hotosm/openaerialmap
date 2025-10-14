import React from 'react';

import '@awesome.me/webawesome/dist/components/drawer/drawer.js';
import '@awesome.me/webawesome/dist/components/button/button.js';
import '@awesome.me/webawesome/dist/components/button-group/button-group.js';
import '@awesome.me/webawesome/dist/components/icon/icon.js';
import '@awesome.me/webawesome/dist/components/divider/divider.js';

import { useStac } from '../context/StacContext';
import { StacItem } from 'stac-ts';

interface DetailProps {
  isDetailPaneShown: boolean;
  setShowDetailPane: (isShown: boolean) => void;
}

export default function Detail({
  isDetailPaneShown,
  setShowDetailPane
}: DetailProps) {
  const { selectedItem, stacItems, setSelectedItem } = useStac();

  const itemData = stacItems?.features.find(
    (item) => item.id === selectedItem
  ) as StacItem | undefined;

  const formatDate = (dateString?: string) => {
    if (!dateString || dateString === 'N/A') return '';
    return new Date(dateString).toISOString().split('T')[0];
  };

  const title = itemData?.id
    ? `${itemData.id} - ${formatDate(itemData.properties?.datetime as string)}`
    : 'Item Details';

  const currentIndex =
    stacItems?.features.findIndex((item) => item.id === selectedItem) ?? -1;

  const totalResults = stacItems?.features.length ?? 0;

  return (
    <wa-drawer
      label={title}
      placement='start'
      open={isDetailPaneShown}
      wa-after-hide={() => setShowDetailPane(false)}
      style={{ '--size': '420px' } as React.CSSProperties}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '8px',
          position: 'absolute',
          top: '16px',
          right: '16px'
        }}
      />

      {itemData ? (
        <div style={{ padding: '0 8px' }}>
          <div
            style={{
              backgroundColor: '#f0f2f3',
              padding: '16px',
              marginBottom: '16px',
              borderRadius: '4px'
            }}
          >
            <div style={{ marginBottom: '8px' }}>
              <small style={{ color: '#6c757d' }}>UPLOADED BY</small>
              <div>
                {itemData.properties['oam:producer_name']
                  ? (itemData.properties['oam:producer_name'] as string)
                  : 'N/A'}
              </div>
            </div>

            <div
              style={{
                width: '100%',
                height: '210px',
                borderRadius: '4px',
                overflow: 'hidden',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: '16px',
                backgroundColor: '#e9ecef'
              }}
            >
              {itemData.assets?.thumbnail ? (
                <img
                  src={itemData.assets.thumbnail.href}
                  alt={itemData.id}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <div>No image preview available</div>
              )}
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <wa-button size='small' variant='text'>
                <wa-icon slot='prefix' name='eye' />
                Display as
              </wa-button>
              <div>
                <wa-button-group>
                  <wa-button size='small' variant='default'>
                    TMS
                  </wa-button>
                  <wa-button size='small' variant='default'>
                    Thumbnail
                  </wa-button>
                </wa-button-group>
              </div>
            </div>
          </div>

          {/* Action links */}
          <div style={{ marginBottom: '16px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '8px'
              }}
            >
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <wa-icon name='box-arrow-up-right' />
                <span>Open in</span>
              </div>
              <div>
                <a
                  href='#'
                  style={{
                    textDecoration: 'none',
                    color: '#0d6efd',
                    marginRight: '8px'
                  }}
                >
                  iD editor
                </a>
                <a
                  href='#'
                  style={{ textDecoration: 'none', color: '#0d6efd' }}
                >
                  JOSM
                </a>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <wa-icon name='clipboard' />
                <span>Copy image URL</span>
              </div>
              <div>
                <a
                  href='#'
                  style={{
                    textDecoration: 'none',
                    color: '#0d6efd',
                    marginRight: '8px'
                  }}
                >
                  TMS
                </a>
                <a
                  href='#'
                  style={{ textDecoration: 'none', color: '#0d6efd' }}
                >
                  WMTS
                </a>
              </div>
            </div>
          </div>

          <wa-divider style={{ margin: '16px 0' }} />

          {/* Metadata table */}
          <div style={{ margin: '16px 0' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td
                    style={{ padding: '8px 0', color: '#6c757d', width: '30%' }}
                  >
                    DATE
                  </td>
                  <td style={{ padding: '8px 0', textAlign: 'right' }}>
                    {itemData.properties.created
                      ? formatDate(itemData.properties.created)
                      : 'N/A'}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '8px 0', color: '#6c757d' }}>
                    RESOLUTION
                  </td>
                  <td style={{ padding: '8px 0', textAlign: 'right' }}>
                    {itemData.properties.gsd ? itemData.properties.gsd : 'N/A'}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '8px 0', color: '#6c757d' }}>
                    PROVIDER
                  </td>
                  <td style={{ padding: '8px 0', textAlign: 'right' }}>
                    {itemData.properties.providers &&
                    itemData.properties.providers.length
                      ? itemData.properties.providers
                          .map((provider) => provider.name)
                          .join(',')
                      : 'N/A'}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '8px 0', color: '#6c757d' }}>
                    PLATFORM
                  </td>
                  <td style={{ padding: '8px 0', textAlign: 'right' }}>
                    {itemData.properties.platform
                      ? itemData.properties.platform
                      : 'N/A'}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '8px 0', color: '#6c757d' }}>SENSOR</td>
                  <td style={{ padding: '8px 0', textAlign: 'right' }}>
                    {itemData.properties.instruments
                      ? itemData.properties.instruments.join(',')
                      : 'N/A'}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '8px 0', color: '#6c757d' }}>
                    IMAGE SIZE
                  </td>
                  <td style={{ padding: '8px 0', textAlign: 'right' }}>
                    {itemData.assets.visual
                      ? (itemData.assets.visual['file:size'] as number)
                      : 'N/A'}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '8px 0', color: '#6c757d' }}>TYPE</td>
                  <td style={{ padding: '8px 0', textAlign: 'right' }}>
                    {/* Image + Map Layer */}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '8px 0', color: '#6c757d' }}>
                    LICENSE
                  </td>
                  <td style={{ padding: '8px 0', textAlign: 'right' }}>
                    <a
                      href='#'
                      style={{ textDecoration: 'none', color: '#0d6efd' }}
                    >
                      {itemData.properties.license
                        ? itemData.properties.license
                        : 'N/A'}
                    </a>
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '8px 0', color: '#6c757d' }}>ID</td>
                  <td style={{ padding: '8px 0', textAlign: 'right' }}>
                    {itemData.id}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div style={{ padding: '16px', textAlign: 'center' }}>
          No item selected or data unavailable
        </div>
      )}

      {/* Footer navigation */}
      <div
        slot='footer'
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: '100%'
        }}
      >
        <wa-button
          size='small'
          variant='text'
          disabled={currentIndex <= 0}
          onClick={() => {
            if (currentIndex > 0 && stacItems?.features) {
              const prevItem = stacItems.features[currentIndex - 1];
              setSelectedItem(prevItem.id);
            }
          }}
        >
          <wa-icon slot='prefix' name='chevron-left' />
          Previous
        </wa-button>

        <div>
          {currentIndex + 1} of {totalResults} results
        </div>

        <wa-button
          size='small'
          variant='text'
          disabled={currentIndex >= totalResults - 1}
          onClick={() => {
            if (currentIndex < totalResults - 1 && stacItems?.features) {
              const nextItem = stacItems.features[currentIndex + 1];
              setSelectedItem(nextItem.id);
            }
          }}
        >
          Next
          <wa-icon slot='suffix' name='chevron-right' />
        </wa-button>
      </div>
    </wa-drawer>
  );
}
