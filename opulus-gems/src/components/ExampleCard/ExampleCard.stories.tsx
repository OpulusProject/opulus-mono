import type { Meta, StoryObj } from '@storybook/react';

import { ExampleCard } from '@opulus/gems';

const meta = {
  title: 'Gems/ExampleCard',
  component: ExampleCard,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    title: {
      control: 'text',
    },
    description: {
      control: 'text',
    },
  },
} satisfies Meta<typeof ExampleCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: 'Card Title',
    description: 'This is a description of the card.',
    children: <p>Card content goes here</p>,
  },
};

export const TitleOnly: Story = {
  args: {
    title: 'Card with Title',
    children: <p>Content without description</p>,
  },
};

export const WithContent: Story = {
  args: {
    title: 'Card Title',
    description: 'This card has custom content.',
    children: (
      <div>
        <p className="mb-2">Custom content section</p>
        <button className="text-sm px-4 py-2 bg-primary text-primary-foreground rounded">
          Action Button
        </button>
      </div>
    ),
  },
};

