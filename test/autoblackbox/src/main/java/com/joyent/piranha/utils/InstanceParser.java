package com.joyent.piranha.utils;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.joyent.piranha.pageobject.InstanceVO;

import java.io.FileNotFoundException;
import java.io.InputStreamReader;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public final class InstanceParser {

    public static final String DATACENTER = "datacenter";
    public static final String IMAGE_NAME = "imageName";
    public static final String VERSION = "version";
    public static final String PACKAGE_NAME = "packageName";
    public static final String PACKAGE_VERSION = "packageVersion";
    public static final String RAM = "RAM";
    public static final String DISK_SPACE = "diskSpace";
    public static final String PRICE_PER_HOUR = "pricePerHour";
    public static final String CPU = "CPU";
    public static final String PRICE_PER_MONTH = "pricePerMonth";
    public static final String SCOPE = "scope";
    public static final String MANUAL = "manual";
    public static final String QUICK = "quick";
    public static final String FREE = "free";
    public static final String PAID = "paid";
    public static final String FREE_TIER_NAME = "freeTierName";
    private static Map<String, List<InstanceVO>> imagesMap;

    private static Map<String, List<InstanceVO>> parseImages(JsonArray imagesJson) {
        Map<String, List<InstanceVO>> datacenterMap = new HashMap<>();

        for (JsonElement jsonElement : imagesJson) {
            final JsonObject jsonObject = jsonElement.getAsJsonObject();
            final JsonArray datacenters = jsonObject.getAsJsonArray(DATACENTER);
            for (JsonElement datacenter : datacenters) {
                InstanceVO instanceVO = new InstanceVO();
                instanceVO.setDatacenter(datacenter.getAsString());
                instanceVO.setImageName(jsonObject.getAsJsonPrimitive(IMAGE_NAME).getAsString());
                instanceVO.setVersion(jsonObject.getAsJsonPrimitive(VERSION).getAsString());
                instanceVO.setPackageName(jsonObject.getAsJsonPrimitive(PACKAGE_NAME).getAsString());
                instanceVO.setPackageVersion(jsonObject.getAsJsonPrimitive(PACKAGE_VERSION).getAsString());
                instanceVO.setRam(jsonObject.getAsJsonPrimitive(RAM).getAsString());
                instanceVO.setDiskSpace(jsonObject.getAsJsonPrimitive(DISK_SPACE).getAsString());
                instanceVO.setCpu(jsonObject.getAsJsonPrimitive(CPU).getAsString());
                instanceVO.setPricePerHour(jsonObject.getAsJsonPrimitive(PRICE_PER_HOUR).getAsString());
                instanceVO.setPricePerMonth(jsonObject.getAsJsonPrimitive(PRICE_PER_MONTH).getAsString());
                final JsonObject scope = jsonObject.getAsJsonObject(SCOPE);
                instanceVO.setManual(scope.getAsJsonPrimitive(MANUAL).getAsBoolean());
                final JsonObject quick = scope.getAsJsonObject(QUICK);
                instanceVO.setFree(quick.getAsJsonPrimitive(FREE).getAsBoolean());
                instanceVO.setPaid(quick.getAsJsonPrimitive(PAID).getAsBoolean());
                instanceVO.setFreeTierName(jsonObject.getAsJsonPrimitive(FREE_TIER_NAME).getAsString());
                List<InstanceVO> instances = datacenterMap.get(instanceVO.getDatacenter());
                if (instances == null) {
                    instances = new ArrayList<>();
                    datacenterMap.put(instanceVO.getDatacenter(), instances);
                }
                instances.add(instanceVO);
            }
        }
        return datacenterMap;
    }

    public static InstanceVO popInstance(String datacenter) throws FileNotFoundException {
        List<InstanceVO> instances = getInstance(datacenter);
        InstanceVO instanceVO = instances.get(0);
        instances.remove(instanceVO);
        return instanceVO;
    }

    public static List<InstanceVO> getInstance(String datacenter) throws FileNotFoundException {
        if (imagesMap == null) {
            JsonArray jsonArray = new JsonParser().parse(new InputStreamReader(ClassLoader.getSystemResourceAsStream("images.json"))).getAsJsonArray();
            imagesMap = parseImages(jsonArray);
        }
        return imagesMap.get(datacenter);
    }
}
