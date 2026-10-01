import { Select } from "./select";

type Category = { name: string; color: string; usageCount?: number };

export function CategorySelect({
  categories,
  value,
  onChange,
}: {
  categories: Category[];
  value: string;
  onChange: (name: string) => void;
}) {
  return (
    <Select
      aria-label="订阅分类"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="" data-add>
        新增分类
      </option>
      {categories.map((category) => (
        <option
          key={category.name}
          value={category.name}
          data-color={category.color}
          data-description={`${category.usageCount || 0} 个订阅`}
        >
          {category.name}
        </option>
      ))}
    </Select>
  );
}
