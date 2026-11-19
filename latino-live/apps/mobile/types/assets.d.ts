// The 3D stage ships as one local page that the room's web view opens.
declare module "*.html" {
  const asset: number;
  export default asset;
}
