import DashboardLayout from '@/components/DashboardLayout'
import IfcConverter from '@/components/IfcConverter'

export const metadata = {
  title: 'Import IFC ',
  description: 'Convert and import IFC building models directly into  scenes.',
}

export default function IfcImportPage() {
  return (
    <DashboardLayout activeTab="ifc">
      <IfcConverter />
    </DashboardLayout>
  )
}
