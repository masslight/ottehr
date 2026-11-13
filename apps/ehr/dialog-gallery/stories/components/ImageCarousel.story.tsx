import { ReactElement, useState } from 'react';
import ImageCarousel from 'src/components/ImageCarousel';
import { defineStory } from '../../harness/story';
import { placeholderImage } from './_shared';

const Host = (): ReactElement => {
  const [open, setOpen] = useState(true);
  const [index, setIndex] = useState(0);
  return (
    <ImageCarousel
      open={open}
      setOpen={setOpen}
      imageIndex={index}
      setImageIndex={setIndex}
      imagesObj={[
        { alt: 'Photo ID front', url: placeholderImage.front },
        { alt: 'Photo ID back', url: placeholderImage.back },
      ]}
    />
  );
};

export default defineStory({
  title: 'Image carousel (full-size image preview)',
  source: 'apps/ehr/src/components/ImageCarousel.tsx',
  base: 'MUI Dialog',
  kind: 'viewer',
  where: 'Visit details / telemed patient photos / document thumbnails → click an image',
  notes:
    'Images are inline SVG placeholders (external image requests are blocked in the capture sandbox). The dialog paper is transparent by design, so the crop shows the backdrop behind it.',
  render: () => <Host />,
});
