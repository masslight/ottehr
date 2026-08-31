export const mockStyle: React.CSSProperties = {
  border: '2px solid red',
  padding: '20px',
  marginTop: '10px',
  borderRadius: '5px',
};

const MockComponent: React.FC<{ child: React.ReactNode }> = ({ child }) => <div style={mockStyle}>{child}</div>;

export const ERX = (): React.ReactElement => <MockComponent child={<div>ERX</div>} />;
