import { ServiceWorkflowCard } from "../ServiceWorkflowCard";

export default function ServiceWorkflowCardExample() {
  return (
    <div className="p-6 bg-background max-w-sm">
      <ServiceWorkflowCard
        customerName="Rajesh Kumar"
        vehicleReg="MH-12-AB-1234"
        status="working"
        handler="Amit Sharma"
        startTime="2h ago"
        onClick={() => console.log("Service card clicked")}
      />
    </div>
  );
}
