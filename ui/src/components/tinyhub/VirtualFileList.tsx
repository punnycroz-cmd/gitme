import { List } from 'react-window';
import { FileSection } from './views/dump';

interface VirtualFileListProps {
  files: Record<string, string>;
  isDark: boolean;
}

const Row = ({ index, style, data }: any) => {
  const { filesArray, isDark } = data as { filesArray: [string, string][]; isDark: boolean };
  const [path, content] = filesArray[index];
  return (
    <div style={style}>
      <FileSection path={path} content={content} isDark={isDark} delay={Math.min(index * 0.01, 0.3)} />
    </div>
  );
};

export const VirtualFileList: React.FC<VirtualFileListProps> = ({ files, isDark }) => {
  const filesArray = Object.entries(files);
  const itemCount = filesArray.length;
  const itemSize = 80; // Approximate row height

  return (
    <List
      rowCount={itemCount}
      rowHeight={itemSize}
      rowProps={{ filesArray, isDark }}
      rowComponent={Row}
      defaultHeight={Math.min(itemCount * itemSize, 600)}
    />
  );
};

export default VirtualFileList;
