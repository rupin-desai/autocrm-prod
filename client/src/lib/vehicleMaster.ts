import { VEHICLE_DATA } from "@shared/vehicleData";

export interface VehicleMasterModel {
  id: string;
  name: string;
  active: boolean;
}

export interface VehicleMasterBrand {
  id: string;
  name: string;
  active: boolean;
  models: VehicleMasterModel[];
}

export interface VehicleMasterResponse {
  brands: VehicleMasterBrand[];
}

export function buildLegacyVehicleMaster(): VehicleMasterBrand[] {
  return VEHICLE_DATA.map((brand) => ({
    id: `legacy-${brand.name}`,
    name: brand.name,
    active: true,
    models: (brand.models || [])
      .filter((model) => model.name !== "Other")
      .map((model) => ({
        id: `legacy-${brand.name}-${model.name}`,
        name: model.name,
        active: true,
      })),
  }));
}

export function getVehicleMasterBrands(
  response?: VehicleMasterResponse | null
): VehicleMasterBrand[] {
  return response?.brands?.length ? response.brands : buildLegacyVehicleMaster();
}

export function getVehicleMasterModels(
  brands: VehicleMasterBrand[],
  brandName: string
): VehicleMasterModel[] {
  return brands.find((brand) => brand.name === brandName)?.models || [];
}
