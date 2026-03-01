import { DigitalCustomerCard } from "../DigitalCustomerCard";

export default function DigitalCustomerCardExample() {
  return (
    <div className="p-6 bg-background">
      <DigitalCustomerCard
        customer={{
          name: "Rajesh Kumar",
          phone: "+91 98765-43210",
          email: "rajesh.kumar@email.com",
          vehicle: {
            regNo: "MH-12-AB-1234",
            make: "Maruti Suzuki",
            model: "Swift",
            year: 2020,
          },
        }}
        totalVisits={8}
        lastHandler="Amit Sharma"
        currentHandler="Priya Patel"
        recentVisits={[
          {
            date: "15 Jan, 2024",
            handler: "Amit Sharma",
            status: "Completed",
            parts: ["Engine Oil", "Oil Filter"],
          },
          {
            date: "10 Dec, 2023",
            handler: "Priya Patel",
            status: "Completed",
            parts: ["Brake Pads", "Brake Fluid"],
          },
        ]}
      />
    </div>
  );
}
