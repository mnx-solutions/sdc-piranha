package com.joyent.piranha.pageobject.instancedetails;

public class MetadataSection extends TagSection {

    public void addMetadata(String key, String value) {
        addItem(key, value, "metadata");
    }

    public void removeMetadata(String key){
        removeTag(key);
    }
}
