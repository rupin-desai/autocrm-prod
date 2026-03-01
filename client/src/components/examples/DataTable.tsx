import { DataTable } from "../DataTable";
import { StatusBadge } from "../StatusBadge";

const sampleData = [
  { id: "1", name: "Engine Oil Filter", category: "Engine Parts", stock: 45, status: "in_stock" },
  { id: "2", name: "Brake Pads Set", category: "Brake System", stock: 12, status: "low_stock" },
  { id: "3", name: "Air Filter", category: "Engine Parts", stock: 0, status: "out_of_stock" },
];

export default function DataTableExample() {
  return (
    <div className="p-6 bg-background">
      <DataTable
        columns={[
          { header: "Product Name", accessor: "name" },
          { header: "Category", accessor: "category" },
          { header: "Stock", accessor: "stock", className: "text-right" },
          { 
            header: "Status", 
            accessor: (row) => <StatusBadge type="stock" status={row.status as any} />,
            className: "text-right"
          },
        ]}
        data={sampleData}
        onRowClick={(row) => console.log("Row clicked:", row)}
      />
    </div>
  );
}
