import React from 'react';
import { sidebarMenuIcons } from 'src/features/css-module/components/Sidebar';
import { InHouseOrderListPageItemDTO } from 'utils';
import { getStatusColor, InHouseLabsStatusChip } from '../InHouseLabsStatusChip';

export const InHouseLabsAppointmentTooltip: React.FC<{ items: InHouseOrderListPageItemDTO[] }> = ({ items }) => {
  if (!items || items.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        width: '380px',
        padding: '12px 16px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: '20px',
        }}
      >
        <div
          style={{
            width: '48px',
            height: '48px',
            backgroundColor: '#E3F2FD',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: '16px',
          }}
        >
          {sidebarMenuIcons['In-house Labs']}
        </div>
        <div>
          <h2
            style={{
              margin: '0',
              fontSize: '20px',
              fontWeight: '600',
              color: '#333',
              lineHeight: '1.2',
            }}
          >
            In-house Labs
          </h2>
          <p
            style={{
              margin: '4px 0 0 0',
              fontSize: '14px',
              color: '#666',
              fontWeight: '400',
            }}
          >
            {items.length} order{items.length > 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {items.map((item, index) => {
        return (
          <div
            key={item.serviceRequestId}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: '12px',
              paddingBottom: '12px',
              borderBottom: index < items.length - 1 ? '1px solid #E5E7EB' : 'none',
            }}
          >
            <div
              style={{
                flex: '1',
                fontSize: '16px',
                fontWeight: '500',
                color: '#333',
                marginRight: '16px',
              }}
            >
              {item.testItemName}
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                flexShrink: 0,
              }}
            >
              <InHouseLabsStatusChip status={item.status} />

              <div
                style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  backgroundColor: getStatusColor(item.status).backgroundColor,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
