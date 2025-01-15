import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function TabsDemo() {
  return (
    <Tabs defaultValue="activePatients" className="w-full">
      <TabsList className="w-full">
        <TabsTrigger value="activePatients" className="flex justify-center text-center">
          Active Patients
        </TabsTrigger>
        <TabsTrigger value="inactivePatients" className="flex justify-center text-center">
          Inactive Patients
        </TabsTrigger>
      </TabsList>
      <TabsContent value="activePatients"></TabsContent>
      <TabsContent value="inactivePatients"></TabsContent>
    </Tabs>
  );
}
