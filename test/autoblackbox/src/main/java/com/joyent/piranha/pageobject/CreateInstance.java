package com.joyent.piranha.pageobject;

public interface CreateInstance {
    Instances createInstance(InstanceVO instanceVO);

    void selectDataCenter(String datacenter);
}
